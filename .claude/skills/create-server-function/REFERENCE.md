# Reference

## Module layout

```text
apps/web/src/libs/api/<domain>.ts     ← search schema, server functions, query options
apps/web/src/routes/<path>.tsx        ← validateSearch, loader, component
packages/services/src/modules/<domain>/
  <domain>.service.ts                 ← the queries
  <domain>.type.ts                    ← input/row types
  <domain>.helper.ts                  ← input normalisation (only if it paginates)
```

Canonical references: `apps/web/src/libs/api/admin-categories.ts` (paginated admin
list + mutations) and `apps/web/src/libs/api/topics.ts` (two independent lists).

---

## Server function pattern

The whole module is one file. Order it: search schema → server functions → query
keys → `queryOptions` factories → mutations.

```ts
// apps/web/src/libs/api/widgets.ts
import { PAGINATION, SORT_ORDER, WIDGET_SORT } from "@brief/common/constants";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pageParam, pageSizeParam, searchParam } from "#/libs/api/search-params";
import { adminMiddleware } from "#/libs/server/middleware";

/** What the page reads out of its URL. `.default()` sits here, not in search-params. */
export const widgetsSearchSchema = z.object({
  page: pageParam.default(PAGINATION.DEFAULT_PAGE),
  pageSize: pageSizeParam.default(PAGINATION.DEFAULT_PAGE_SIZE),
  sort: z.enum(WIDGET_SORT).default(WIDGET_SORT.NAME),
  order: z.enum(SORT_ORDER).default(SORT_ORDER.DESC),
  q: searchParam,
});

export type WidgetsSearch = z.output<typeof widgetsSearchSchema>;

export const getWidgets = createServerFn({ method: "GET" })
  .middleware([adminMiddleware])
  .validator(widgetsSearchSchema)
  .handler(({ data, context }) =>
    context.container.widgetsService.listForAdmin({
      page: data.page,
      pageSize: data.pageSize,
      sort: data.sort,
      order: data.order,
      search: data.q,
    }),
  );

/** Prefix, so one invalidation refreshes every page of the list. */
export const WIDGETS_KEY = ["admin", "widgets"] as const;

export const widgetsQueryOptions = (search: WidgetsSearch) =>
  queryOptions({
    queryKey: [...WIDGETS_KEY, search] as const,
    queryFn: () => getWidgets({ data: search }),
  });

export const refreshWidgets = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: WIDGETS_KEY });
```

Note `getWidgets({ data: search })` — arguments always travel in a `data` property.

### Mutations

```ts
const widgetIdInput = z.object({ id: z.uuid() });

export const widgetWriteSchema = z.object({
  name: z.string().trim().min(1).max(WIDGET_NAME_MAX_LENGTH),
  isEnabled: z.boolean(),
});

export type WidgetFormValues = z.output<typeof widgetWriteSchema>;

export const createWidget = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(widgetWriteSchema)
  .handler(async ({ data, context }) => {
    const { id } = await context.container.widgetsService.create(data);

    return { id };
  });

export const deleteWidget = createServerFn({ method: "POST" })
  .middleware([adminMiddleware])
  .validator(widgetIdInput)
  .handler(async ({ data, context }) => {
    await context.container.widgetsService.deleteForAdmin(data.id);

    return { success: true };
  });
```

Reuse one input schema with `.extend()` rather than declaring near-duplicates:
`.validator(widgetIdInput.extend({ isEnabled: z.boolean() }))`.

---

## Middleware

From `apps/web/src/libs/server/middleware.ts`. They chain, so the outer one implies
the inner:

| Middleware | Gives the handler | Throws |
| --- | --- | --- |
| `containerMiddleware` | `context.container` | — |
| `authedMiddleware` | `+ context.user` | 401 if no session |
| `adminMiddleware` | `+ context.user` (admin) | 403 if not admin |

All three include `errorHandlingMiddleware`, which normalises what escapes a handler:
a `DomainError` becomes the status/message in `getDomainErrorResponse`, a Better Auth
`APIError` under 500 is passed through, and anything else is logged and becomes a
generic 500. Redirects and `notFound` pass through untouched.

A user-scoped list reads the id from the session, never from the input:

```ts
.handler(({ data, context }) =>
  context.container.subscriptionsService.listSubscribed({
    userId: context.user.id,
    page: data.page,
    search: data.search,
  }),
)
```

---

## Errors

```ts
import { createForbiddenError, ServerError } from "#/libs/server/errors";

throw createUnauthorizedError();     // 401
throw createForbiddenError();        // 403
throw createTooManyRequestsError();  // 429
throw new ServerError("message", 409);
```

For a failure the domain owns, throw a `DomainError` from the service and map it once
in `libs/server/errors.ts`:

```ts
// packages/services/src/modules/widgets/widgets.service.ts
import { DomainError } from "@brief/infra/errors";
import { DOMAIN_ERROR_CODE } from "@brief/common/constants";

throw new DomainError({ code: DOMAIN_ERROR_CODE.WIDGET_NOT_FOUND });
```

Wiring a new domain error touches three places:

1. `packages/common/src/constants` — add the code to `DOMAIN_ERROR_CODE`.
2. `packages/services` — throw it.
3. `apps/web/src/libs/server/errors.ts` — add the status and user-facing message to
   `DOMAIN_ERROR_RESPONSES`. It is a `Record<DomainErrorCode, …>`, so a missing entry
   is a type error, not a silent 500.

Rebuild `common` before `services` (`pnpm run dev:libs:build`).

### Errors a route must survive

`attempt` in `libs/server/result.ts` turns a sub-500 failure into a `Result` instead of
propagating, for a loader that should render a partial page rather than an error page.
`unwrap` in `libs/api/unwrap.ts` goes the other way.

---

## Service pattern

Services are classes taking `Database` from `@brief/drizzle`. A paginated read
normalises its input, queries, and wraps with `toPage`:

```ts
// packages/services/src/modules/widgets/widgets.service.ts
import type { Paginated } from "@brief/common/types";
import { asc, type Database, desc, ilike, schema, sql } from "@brief/drizzle";
import { toPage } from "../../helpers/listQuery.helper.js";
import { normalizeListWidgetsInput } from "./widgets.helper.js";
import type { ListWidgetsInput, WidgetRow } from "./widgets.type.js";

export class WidgetsService {
  constructor(private db: Database) {}

  async listForAdmin(
    input: ListWidgetsInput = {},
  ): Promise<Paginated<WidgetRow>> {
    const normalized = normalizeListWidgetsInput(input);
    const { sort, order, searchPattern, pageSize, offset } = normalized;

    const where = searchPattern
      ? ilike(schema.widgets.name, searchPattern)
      : undefined;

    // A fixed map, so the sort key from the URL can never reach SQL as text.
    const direction = order === "asc" ? asc : desc;
    const orderBy = { name: schema.widgets.name }[sort];

    const [items, [totals]] = await Promise.all([
      this.db
        .select()
        .from(schema.widgets)
        .where(where)
        .orderBy(direction(orderBy), asc(schema.widgets.id))
        .limit(pageSize)
        .offset(offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(schema.widgets)
        .where(where),
    ]);

    return toPage(items, totals?.total ?? 0, normalized);
  }
}
```

The count runs with the same `where` and without the window — sorting or paging must
not change the total.

Order by a unique column last (`asc(schema.widgets.id)` above). Without a tiebreaker,
rows equal on the sort key can be returned in a different order between two queries,
so a row shows up on both page 1 and page 2 while another is never seen.

### The normalisation helper

Input arrives all-optional and leaves fully settled. Keep it beside the service so the
service body stays query-shaped:

```ts
// packages/services/src/modules/widgets/widgets.helper.ts
import {
  normalizePage,
  normalizeSort,
  toSearchPattern,
} from "../../helpers/listQuery.helper.js";

export const normalizeListWidgetsInput = ({
  page,
  pageSize,
  sort,
  order,
  search,
}: ListWidgetsInput): NormalizedListWidgetsInput => ({
  ...normalizePage({ page, pageSize }),
  ...normalizeSort(
    { sort, order },
    {
      values: WIDGET_SORT_VALUES,
      defaultSort: DEFAULT_WIDGET_SORT,
      defaultOrder: DEFAULT_WIDGET_SORT_ORDER,
    },
  ),
  searchPattern: toSearchPattern(search, WIDGET_SEARCH_MAX_LENGTH),
});
```

```ts
// packages/services/src/modules/widgets/widgets.type.ts
import type { PageWindow } from "../../helpers/listQuery.helper.js";

export type ListWidgetsInput = {
  page?: number;
  pageSize?: number;
  sort?: WidgetSort;
  order?: SortOrder;
  search?: string;
};

/** Same shape after normalisation, with every value settled. */
export type NormalizedListWidgetsInput = PageWindow & {
  sort: WidgetSort;
  order: SortOrder;
  searchPattern: string | undefined;
};
```

### `listQuery.helper.ts` API

| Helper | Returns |
| --- | --- |
| `normalizePage({ page, pageSize }, { defaultPageSize?, maxPageSize? })` | `PageWindow` — `{ page, pageSize, offset }`, clamped |
| `normalizeSort({ sort, order }, { values, defaultSort, defaultOrder })` | `{ sort, order }`, unknown keys falling back |
| `toSearchPattern(search, maxLength)` | `%escaped%` for ILIKE, or `undefined` |
| `toPage(items, total, pageWindow)` | `Paginated<T>`, `pageCount` at least 1 |

A list whose page size the reader does **not** choose passes `defaultPageSize` and
leaves `pageSize` out of its own input type, rather than trusting the caller.

Never interpolate a search term into SQL yourself — `toSearchPattern` escapes `%`, `_`
and `\`, so someone searching "100%" finds that text.

### Wiring the service

Export from `packages/services/src/index.ts`, keeping it sorted. Note that `auth` and
`mail` are deliberately **absent** from the barrel — they sit behind
`@brief/services/auth` and `@brief/services/mail` so workers do not load `better-auth`
and `resend` at boot. A new service reaching for either belongs to `apps/web`.

Then instantiate it in `apps/web/src/libs/server/container.ts`:

```ts
return {
  db,
  // ...
  widgetsService: new WidgetsService(db),
};
```

The container is memoised on a global symbol, so it survives dev-server reloads.

---

## Route pattern

```tsx
// apps/web/src/routes/admin/widgets.tsx
export const Route = createFileRoute("/admin/widgets")({
  validateSearch: widgetsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: queryLoader(widgetsQueryOptions),
  head: localisedHead((t) => ({
    title: t.auth.admin.widgets.title,
    path: ROUTES.adminWidgets,
    noindex: true,
  })),
  component: AdminWidgetsPage,
});

function AdminWidgetsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data, isFetching, isError } = useQuery({
    ...widgetsQueryOptions(search),
    // The previous page stays on screen while the next one loads.
    placeholderData: keepPreviousData,
  });

  const handleSearchChange = useCallback(
    (patch: Partial<WidgetsSearch>) => {
      void navigate({
        search: (previous) => ({ ...previous, ...patch }),
        // Typing must not fill the history stack.
        replace: "q" in patch,
      });
    },
    [navigate],
  );

  // ...
}
```

`loaderDeps: ({ search }) => search` is required — without it the loader does not
re-run when the params change, and page 2 renders page 1's data.

`queryLoader(...queryOptionsFactories)` warms every query a page reads and returns
`{ locale }` for `head`. A page whose `head` needs more than the locale writes its
loader out and calls `prefetchQueries` directly:

```tsx
loader: async ({ context, deps }) => {
  await prefetchQueries(context.queryClient, [widgetsQueryOptions(deps)]);

  return { locale: readStoredLocale(), page: deps.page };
},
```

Under SSR `prefetchQueries` awaits — the data *is* the markup. On a client transition
it only warms the cache, so the navigation lands immediately.

### Mutations from a component

```tsx
const queryClient = useQueryClient();

const remove = useMutation({
  mutationFn: (widget: WidgetRow) => deleteWidget({ data: { id: widget.id } }),
  onSuccess: async (_result, widget) => {
    await refreshWidgets(queryClient);
    notifySuccess(labels.notifications.deleted(widget.name));
  },
  onError: () => notifyError(t.auth.genericError),
});
```

Invalidate through the domain's exported `refresh*` helper, not an inline
`invalidateQueries` — one mutation often has to refresh two lists (creating a category
refreshes both the admin table and the public topics).

---

## Import map

| What you need | Import path |
| --- | --- |
| Server function | `@tanstack/react-start` → `createServerFn` |
| Middleware | `#/libs/server/middleware` → `containerMiddleware`, `authedMiddleware`, `adminMiddleware` |
| Throwable errors | `#/libs/server/errors` → `ServerError`, `createForbiddenError`, … |
| Domain error | `@brief/infra/errors` → `DomainError`, `isDomainError` |
| URL param schemas | `#/libs/api/search-params` → `pageParam`, `pageSizeParam`, `searchParam` |
| Loader helpers | `#/libs/api/query-loader` → `queryLoader`, `prefetchQueries` |
| Pagination helpers | `packages/services/src/helpers/listQuery.helper.js` → `normalizePage`, `normalizeSort`, `toSearchPattern`, `toPage` |
| Pagination defaults / result type | `@brief/common/constants` → `PAGINATION`, `SORT_ORDER`; `@brief/common/types` → `Paginated`, `SortOrder` |
| DB client + helpers | `@brief/drizzle` → `Database`, `eq`, `schema`, `ilike`, `asc`, `desc` |
| Business logic | `@brief/services` (not `auth` / `mail` — those are subpaths) |
| Logger | `@brief/infra/libs` → `pinoLogger` |

`#/` is the `apps/web/src` alias. Imports inside `packages/*` use relative paths with
a `.js` extension.

---

## Delivery checklist

- [ ] One file: `apps/web/src/libs/api/<domain>.ts`. No `.schema.ts` / `.route.ts` /
      `.controller.ts` split, no response envelope, no OpenAPI, no status codes.
- [ ] Every server function has a `.middleware([...])` and a `.validator(schema)`.
- [ ] Reads are `method: "GET"`, writes are `method: "POST"`.
- [ ] Handlers delegate to a service — no Drizzle in `apps/web`.
- [ ] A user-scoped read takes `userId` from `context.user`, never from input.
- [ ] Failures are thrown (`ServerError` / `DomainError`), never returned.
- [ ] A new domain error is in `DOMAIN_ERROR_CODE` **and** `DOMAIN_ERROR_RESPONSES`.
- [ ] Zod v4 top-level helpers (`z.uuid()`, not `z.string().uuid()`).
- [ ] A list returns `Paginated<T>` via `toPage`, and normalises input through
      `normalizePage` / `normalizeSort` / `toSearchPattern`.
- [ ] The sort key selects a SQL column from a fixed map; the search term goes through
      `toSearchPattern`.
- [ ] The total is counted with the same `where` and no window.
- [ ] Query keys share an exported prefix, with a `refresh*` helper for invalidation.
- [ ] Route has `validateSearch`, `loaderDeps: ({ search }) => search`, and a loader
      that warms its queries.
- [ ] Paginated lists use `placeholderData: keepPreviousData`; search navigation uses
      `replace`.
- [ ] Service exported from `packages/services/src/index.ts` and instantiated in
      `apps/web/src/libs/server/container.ts`.
- [ ] `pnpm run dev:libs:build` before typechecking `apps/web` — it consumes `dist`.
