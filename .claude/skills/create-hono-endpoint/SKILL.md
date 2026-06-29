---
name: create-hono-endpoint
description: Scaffolds a new domain module under `apps/hono/src/modules/<domain>/` following this repo's schema-first conventions. Use when adding a new route/domain to the Hono backend, when request/response schemas must be defined in `<domain>.schema.ts`, or when wiring a new service from `packages/services` into the app.
---

# Create Hono Endpoint

## Purpose

Add a new domain module to `apps/hono/` following the repo's strict schema-first, type-safe conventions.

## Workspace layout

```text
apps/
  hono/                   ← the backend app
packages/
  infra/                  ← factories, helpers, middlewares, OpenAPI helpers
  services/               ← business logic (classes taking a DB client)
  common/                 ← cross-app schemas, enums, error constants
```

Drizzle database client is imported from `@brief/drizzle`.  
There is no `packages/db` — persistence goes through `@brief/drizzle` directly in services.

## Workflow

1. Read the existing module structure before creating anything — use `health` as the canonical reference.
2. Create `apps/hono/src/modules/<domain>/` with exactly these four files:
   - `<domain>.schema.ts`
   - `<domain>.route.ts`
   - `<domain>.type.ts`
   - `<domain>.controller.ts`
3. If business logic is needed, add the service in `packages/services/src/modules/<domain>/`.
4. Wire the controller into `apps/hono/src/app.ts`.
5. Export the new service from `packages/services/src/index.ts` if needed.

## Rules

- Schema-first: every JSON response must come from a schema declared in `<domain>.schema.ts`.
- Do not return untyped ad hoc objects from controllers.
- Use `ApiResponse<T>` from `@brief/infra/types` to type controller responses.
- Use `openApiResponse` (single item) or `openApiResponses` (list with meta) from `@brief/infra/helpers` in route files.
- Use `openApiProtectedRoute` for authenticated routes (adds 401 response automatically).
- Use `appWithLogs` from `@brief/infra/factories` as the Hono factory in controllers.
- Services are classes that take `Database` from `@brief/drizzle` as constructor argument.
- Services receive `Database` from `AppServices` in `apps/hono/src/services/container.ts`.
- Error responses use `apiError(c, key)` with keys from `API_ERRORS` in `@brief/infra/helpers`.

## Response contract

1. Define the domain payload schema in `<domain>.schema.ts`.
2. In `<domain>.type.ts`, infer the TS type and wrap it with `ApiResponse<T>`.
3. In `<domain>.route.ts`, use the same schema with `openApiResponse` / `openApiResponses`.
4. In the controller, type the response variable as the inferred API type before `c.json(...)`.

See [REFERENCE.md](REFERENCE.md) for file templates and patterns.
