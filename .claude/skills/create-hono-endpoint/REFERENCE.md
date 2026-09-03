# Reference

## Backend module layout

```text
apps/hono/src/modules/<domain>/
  <domain>.schema.ts     ← Zod schemas for request payloads and response shapes
  <domain>.route.ts      ← OpenAPI route descriptions built from the schemas
  <domain>.type.ts       ← z.infer types + ApiResponse<T> wrappers
  <domain>.controller.ts ← Hono handlers only
```

Canonical reference: `apps/hono/src/modules/health/`

---

## Schema pattern

Use Zod v4 top-level helpers (`z.email()`, `z.url()`, etc.) — **not** the deprecated chained forms
(`z.string().email()` is deprecated in v4).

```ts
// <domain>.schema.ts
import { z } from "zod";

export const userSchema = z.object({
  id: z.number(),
  email: z.email(),
  name: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createUserSchema = z.object({
  email: z.email(),
  name: z.string().optional(),
});

export const userIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
```

---

## Type pattern

Infer every transport type from schemas. Use `ApiResponse<T>` from `@brief/infra/types`
to produce the envelope type — do NOT write the `{ data: T }` wrapper by hand.

```ts
// <domain>.type.ts
import type { ApiResponse } from "@brief/infra/types";
import type z from "zod";
import type { userSchema } from "./users.schema.js";

type UserDto = z.infer<typeof userSchema>;
export type UserApiResponse = ApiResponse<UserDto>;
export type UsersApiResponse = ApiResponse<UserDto[]>;
```

Service input types are inferred from the Drizzle schema — do NOT write them by hand:

```ts
import type { schema } from "@brief/drizzle";

export type CreateUserParams = Omit<typeof schema.users.$inferInsert, "id" | "createdAt" | "updatedAt">;
export type UpdateUserParams = Partial<Pick<typeof schema.users.$inferInsert, "username" | "name">>;
```

---

## Route pattern

Use `openApiResponse` for a single-item response and `openApiResponses` for a list (adds optional
pagination `meta`). Use `openApiProtectedRoute` for authenticated routes — it adds the 401 response
automatically.

```ts
// <domain>.route.ts
import {
  openApi404NotFound,
  openApi409Conflict,
  openApiResponse,
  openApiResponses,
} from "@brief/infra/helpers";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { userSchema } from "./users.schema.js";

export const GetUsersRoute = describeRoute({
  description: "Get all users",
  tags: ["users"],
  responses: {
    ...openApiResponses(z.array(userSchema), 200, "List of users"),
  },
});

export const GetUserRoute = describeRoute({
  description: "Get a user by id",
  tags: ["users"],
  responses: {
    ...openApiResponse(userSchema, 200, "User"),
    ...openApi404NotFound("User not found"),
  },
});

export const CreateUserRoute = describeRoute({
  description: "Create a user",
  tags: ["users"],
  responses: {
    ...openApiResponse(userSchema, 201, "Created user"),
    ...openApi409Conflict("Email already in use"),
  },
});
```

---

## Controller pattern

- Use `appWithLogs` from `@brief/infra/factories` as the factory.
- Use **imperative style** (`app.get(...)`, `app.post(...)`) — do NOT chain. The tsconfig has
  `declaration: true`, and chaining with validators produces an inferred return type that TypeScript
  cannot name in the `.d.ts` output (error TS2883).
- Import `validator` from **`hono-openapi`** — do NOT use `sValidator` from
  `@hono/standard-validator` or `validator` from `hono-openapi/zod`.
- Type response variables from the inferred API type before `c.json(...)`.
- Return error responses via `apiError(c, key)`.

```ts
// <domain>.controller.ts
import { API_ERROR } from "@brief/common/constants";
import { appWithLogs } from "@brief/infra/factories";
import { apiError } from "@brief/infra/helpers";
import type { UsersService } from "@brief/services";
import { validator } from "hono-openapi";
import { CreateUserRoute, GetUserRoute, GetUsersRoute } from "./users.route.js";
import { createUserSchema, userIdParamSchema } from "./users.schema.js";
import type { UserApiResponse, UsersApiResponse } from "./users.type.js";

export const createUsersController = (usersService: UsersService) => {
  const app = appWithLogs.createApp();
  app.get("/", GetUsersRoute, async (c) => {
    const users = await usersService.findUsers();
    const response: UsersApiResponse = { data: users };
    return c.json(response, 200);
  });
  app.get("/:id", GetUserRoute, validator("param", userIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const user = await usersService.findUserById(id);
    if (!user) return apiError(c, "USER_NOT_FOUND");
    const response: UserApiResponse = { data: user };
    return c.json(response, 200);
  });
  app.post("/", CreateUserRoute, validator("json", createUserSchema), async (c) => {
    const body = c.req.valid("json");
    const result = await usersService.createUser(body);
    if (result === API_ERROR.EMAIL_ALREADY_EXISTS) return apiError(c, "EMAIL_ALREADY_EXISTS");
    const response: UserApiResponse = { data: result };
    return c.json(response, 201);
  });
  return app;
};
```

---

## Service pattern

Services live in `packages/services/src/modules/<domain>/` and take `Database` from
`@brief/drizzle` as the constructor argument. Use `db.query.<table>` for reads
and `db.insert/update/delete(...).returning()` for writes — always destructure the `[0]` element
since `returning()` gives an array.

```ts
// packages/services/src/modules/users/users.service.ts
import { API_ERROR } from "@brief/common/constants";
import { type Database, eq, schema } from "@brief/drizzle";
import type { CreateUserParams, UpdateUserParams } from "./users.type.js";

export class UsersService {
  constructor(private drizzle: Database) {}

  async findUsers() {
    return await this.drizzle.query.users.findMany();
  }

  async findUserById(userId: number) {
    return await this.drizzle.query.users.findFirst({ where: { id: userId } });
  }

  async findUserByEmail(email: string) {
    return await this.drizzle.query.users.findFirst({ where: { email } });
  }

  async createUser(payload: CreateUserParams) {
    const user = await this.findUserByEmail(payload.email);
    if (user) return API_ERROR.EMAIL_ALREADY_EXISTS;
    const [created] = await this.drizzle.insert(schema.users).values(payload).returning();
    return created;
  }

  async updateUser(userId: number, payload: UpdateUserParams) {
    const user = await this.findUserById(userId);
    if (!user) return API_ERROR.USER_NOT_FOUND;
    const [updated] = await this.drizzle
      .update(schema.users)
      .set(payload)
      .where(eq(schema.users.id, userId))
      .returning();
    return updated;
  }

  async deleteUser(userId: number) {
    const user = await this.findUserById(userId);
    if (!user) return API_ERROR.USER_NOT_FOUND;
    const [deleted] = await this.drizzle
      .delete(schema.users)
      .where(eq(schema.users.id, userId))
      .returning();
    return deleted;
  }
}
```

Export from `packages/services/src/index.ts` (keep sorted alphabetically):

```ts
export * from "./modules/health/health.service.js";
export * from "./modules/posts/posts.service.js";
export * from "./modules/users/users.service.js";
```

---

## App wiring

Services are pre-instantiated in `apps/hono/src/services/container.ts` and passed to controllers
via `AppServices`. Do NOT instantiate services in `app.ts`.

```ts
// apps/hono/src/services/container.ts
import { type Database, db } from "@brief/drizzle";
import { PostsService, UsersService } from "@brief/services";

export type AppServices = {
  db: Database;
  posts: PostsService;
  users: UsersService;
};

export const createServices = (): AppServices => ({
  db,
  posts: new PostsService(db),
  users: new UsersService(db),
});

export const services = createServices();
```

```ts
// apps/hono/src/app.ts (excerpt)
import { createUsersController } from "./modules/users/users.controller.js";
import type { AppServices } from "./services/container.js";

export const createApp = (services: AppServices) =>
  new Hono()
    // ...existing middlewares...
    .route("users", createUsersController(services.users));
```

---

## Error wiring

When a service can return an `API_ERROR` constant, add the corresponding entry to both:

1. `packages/common/src/constants/apiError.constant.ts` — the `API_ERROR` map (source of truth for error codes)
2. `packages/infra/src/helpers/apiErrors.helper.ts` — `ApiErrorKey` union + `API_ERRORS` map (HTTP status + message)

After editing either package, rebuild it before rebuilding dependents:

```sh
pnpm --filter @brief/common build
pnpm --filter @brief/infra build
pnpm --filter @brief/services build
pnpm --filter @brief/hono build
```

---

## Package import map

| What you need | Import path |
| --- | --- |
| Hono app factory | `@brief/infra/factories` → `appWithLogs` |
| OpenAPI response helpers | `@brief/infra/helpers` → `openApiResponse`, `openApiResponses`, `openApiProtectedRoute` |
| API error helpers | `@brief/infra/helpers` → `apiError` |
| Envelope type | `@brief/infra/types` → `ApiResponse<T>` |
| Error constants | `@brief/common/constants` → `API_ERROR` |
| DB client + helpers | `@brief/drizzle` → `Database`, `eq`, `schema` |
| Business logic | `@brief/services` |
| Request validator | `hono-openapi` → `validator` |

---

## Delivery checklist

- [ ] Module lives in `apps/hono/src/modules/<domain>/`.
- [ ] Four files: `<domain>.schema.ts`, `<domain>.route.ts`, `<domain>.type.ts`, `<domain>.controller.ts`.
- [ ] Schemas use Zod v4 API (`z.email()`, not `z.string().email()`).
- [ ] Every API response shape has a schema in `<domain>.schema.ts`.
- [ ] Response types in `<domain>.type.ts` use `ApiResponse<T>` — no hand-written `{ data: T }`.
- [ ] Routes use `openApiResponse` / `openApiResponses` (or `openApiProtectedRoute`).
- [ ] Controller uses `validator` from `hono-openapi` — NOT `sValidator` from `@hono/standard-validator`.
- [ ] Controller uses imperative style (`app.get(...)`) to avoid TS2883 with `declaration: true`.
- [ ] Controller returns variables typed from the inferred API type.
- [ ] Service (if new) added to `packages/services/src/modules/<domain>/` and exported from `packages/services/src/index.ts`.
- [ ] New service instantiated in `apps/hono/src/services/container.ts`, not in `app.ts`.
- [ ] Controller wired in `apps/hono/src/app.ts` with `.route("<domain>", createXxxController(services.xxx))`.
- [ ] New error codes added to both `common` and `infra`, packages rebuilt in dependency order.
