---
name: create-server-function
description: Adds a server-function module under `apps/web/src/libs/api/<domain>.ts` and wires it to a route, following this repo's TanStack Start conventions. Use when adding an endpoint, a paginated list, a mutation, or when wiring a service from `packages/services` into `apps/web`.
---

# Create Server Function

## Purpose

Add an endpoint to `apps/web`. There is no backend app and no HTTP API to design:
`apps/web` is the only HTTP entry point, and an endpoint is a **server function** —
`createServerFn`, called directly from client code as a typed function.

## What this replaces

This repo used to run a Hono backend with OpenAPI route descriptions and a generated
RPC client. Both are gone. Three layers went with them, and re-inventing any of them
is the main way to get this wrong:

- **No response envelope.** A server function returns its value. There is no
  `{ data: T }` wrapper, no `ApiResponse<T>`, no `meta`.
- **No OpenAPI.** Nothing describes a response shape to a client — the client
  *is* the caller, and the return type is inferred end to end.
- **No RPC client and no HTTP status codes in handlers.** Failures are thrown, not
  returned; middleware maps them to a status.

## Workspace layout

```text
apps/
  web/                  ← the only HTTP entry point; server functions live here
  */-worker, scheduler   ← pipeline processes, no HTTP
packages/
  services/             ← business logic (classes taking a Drizzle Database)
  common/               ← constants, shared types, pagination defaults
  infra/                ← pino, redis, amqp, domain errors — no HTTP helpers
db/drizzle/             ← schema & migrations, imported as @brief/drizzle
```

## Workflow

1. Read the closest existing module before writing anything.
   `apps/web/src/libs/api/admin-categories.ts` is the canonical reference for a
   paginated, admin-only list plus mutations; `topics.ts` for two independently
   paged lists on one page.
2. Put the business logic in `packages/services/src/modules/<domain>/` and export
   the service from `packages/services/src/index.ts`.
3. Instantiate the service in `apps/web/src/libs/server/container.ts`.
4. Write `apps/web/src/libs/api/<domain>.ts`: the search schema, the server
   functions, the query keys, and the `queryOptions` factories.
5. Wire the route in `apps/web/src/routes/`: `validateSearch`, `loaderDeps`,
   `loader`, then `useQuery` in the component.
6. Rebuild the libs you changed before typechecking `apps/web` — it consumes
   `dist`, not source: `pnpm run dev:libs:build`.

## Rules

- One file per domain in `apps/web/src/libs/api/`. Do not create a directory or
  split into `.schema.ts` / `.route.ts` / `.type.ts` / `.controller.ts` — that was
  the Hono layout.
- Every server function carries a middleware from
  `apps/web/src/libs/server/middleware.ts`: `containerMiddleware` (public),
  `authedMiddleware` (signed in), or `adminMiddleware` (admin). Never reach for the
  container directly — the middleware is also what installs error handling.
- Every server function validates its input with `.validator(zodSchema)`. All
  external input is untrusted, and the input arrives from a URL.
- Handlers delegate to a service. No Drizzle queries in `apps/web`.
- Reads are `{ method: "GET" }`; writes are `{ method: "POST" }`.
- Throw to fail. `ServerError` helpers in `libs/server/errors.ts`, or a `DomainError`
  from a service. Never return an error code as a value.
- Paginate through the `listQuery.helper.ts` helpers in `packages/services` and the
  param schemas in `libs/api/search-params.ts`. Do not re-derive offsets, clamps or
  `pageCount`.
- Zod v4 top-level helpers: `z.uuid()`, `z.email()` — not `z.string().uuid()`.

## Pagination contract

The one piece worth memorising, because it spans three packages:

| Layer | Does | Uses |
| --- | --- | --- |
| Route | Declares the URL params | `pageParam`, `pageSizeParam`, `searchParam` from `libs/api/search-params` + `PAGINATION` defaults |
| Server fn | Passes them through | `.validator(...)` → `service.list({ page, pageSize, sort, order, search })` |
| Service | Settles and queries | `normalizePage`, `normalizeSort`, `toSearchPattern`, then `toPage(items, total, window)` |

The service returns `Paginated<T>` from `@brief/common/types` —
`{ items, total, page, pageSize, pageCount }`. That is the list contract; a list
that returns a bare array is a bug.

Out-of-range values are **clamped, not rejected**: the numbers come from a URL, where
a stale or hand-edited value is expected. Page 0 means page 1.

See [REFERENCE.md](REFERENCE.md) for file templates and the delivery checklist.
