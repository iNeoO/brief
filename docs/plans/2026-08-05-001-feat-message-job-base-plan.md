---
title: "feat: Add message_jobs base (schema + migration + worker scaffold)"
type: feat
status: active
date: 2026-08-05
origin: docs/daily-pipeline-workflow.md
---

# feat: Add message_jobs base (schema + migration + worker scaffold)

## Overview

Introduce `message_jobs`, a new sub-job of `category_jobs` dedicated to sending the finished brief to users. Today, `ProcessingService.sendMessage` is a no-op stub run as the last step inside the category worker itself — LLM processing (report + audio) and message delivery are one undifferentiated pipeline. This plan only lays the base: the DB table/migration and a standalone consumer app (`message-worker`). No delivery logic, no wiring from `category_jobs` into the new table, and no publishing to the new queue yet.

## Problem Frame

`docs/daily-pipeline-workflow.md` (Step 6, "distribute the result") already anticipates this split conceptually but explicitly says: *"Subscriber and delivery tables do not exist yet."* There is genuinely no `users`/subscribers model in this codebase yet, so this plan cannot build real delivery. What it can do is give the future delivery step its own job table and its own consumer process, so that decoupling doesn't require a schema migration later — only wiring.

## Requirements Trace

- R1. A new table exists to track one message/delivery job per `category_job`.
- R2. A Drizzle migration for that table is generated and reviewed.
- R3. A new standalone consumer app exists, listening on its own queue, structurally ready to receive category-job-finished messages.
- R4. No behavioral change to the existing category pipeline (`ProcessingService.sendMessage` stays a stub; `category_jobs` is not modified to publish to the new queue).

## Scope Boundaries

- No recipient/subscriber model, no actual message sending, no email/push integration.
- `ProcessingService.sendMessage` is *not* wired to create `message_jobs` rows or publish to the new queue in this plan — that wiring is follow-up work once delivery logic exists.
- No retry tracking and no `message_job_events` table (see Key Technical Decisions — explicitly deferred, confirmed with the user).
- No changes to `docker-compose.yaml` (no RabbitMQ container is declared there today either; the broker is assumed external/already running, consistent with `provider_fetch` and `category` queues).

## Context & Research

### Relevant Code and Patterns

- `db/drizzle/src/db/schema.ts` — `providerFetchJobs` (packages/infra/src/amqp analog) and `files` show the two shapes available: a full job-with-retry table (`providerFetchJobs`, `categoryJobs`) vs. a simple child-of-`categoryJob` table (`files`, keyed by `categoryJobId` with cascade delete). `message_jobs` lands closer to `files`: one row per `categoryJob`, minimal columns.
- `apps/category-worker/src/{index.ts,consumer.ts,config/env.ts}` and `apps/providerFetch-worker/src/{index.ts,consumer.ts,config/env.ts}` — the exact scaffold shape to mirror for `apps/message-worker`: a `BaseAmqpConsumer` subclass, an `index.ts` that wires `db`, builds the consumer, and handles `SIGTERM`/`SIGINT` graceful shutdown.
- `packages/infra/src/amqp/{category.ts,providerFetchJob.ts}` — the per-job-type message contract shape: a zod schema `{ id: z.number() }` plus a `safeParse*Message` helper, re-exported from `packages/infra/src/amqp/index.ts`.
- `packages/infra/src/amqp/baseConsumer.ts` — `assertQueueTopology` is called by the consumer itself on connect; queues/DLQs are asserted at runtime, not declared anywhere statically. No docker-compose or topology file needs to change to add a queue.
- `.env.example` — `PROVIDER_FETCH_QUEUE=provider-fetch` / `CATEGORY_QUEUE=category` is the naming convention for new queue env vars.

### Institutional Learnings

- `docs/daily-pipeline-workflow.md`, Step 6 and "Implementation sequence" (item 6, "Subscriber and delivery model") — confirms the subscriber/delivery model is intentionally future work, not something this plan should invent.
- `docs/daily-pipeline-workflow.md`, "Database reset and migration" — this project resets Drizzle migrations rather than preserving history once the schema settles; not a reason to change how this migration is generated now, but explains why the existing migration folder has few, broad migrations rather than many incremental ones.

### External References

None — the codebase has three direct, consistent local examples of the exact pattern needed (job table, migration, consumer app), so no external research was used.

## Key Technical Decisions

- **Table name: `message_jobs`.** Matches the user's own framing ("envoi des messages") and the existing `<domain>_jobs` naming convention (`provider_fetch_jobs`), decided over `delivery_jobs` (which would have matched `docs/daily-pipeline-workflow.md`'s "distribution"/"delivery" wording instead). Confirmed with the user.
- **No retry column, no `message_job_events` table — but keep a plain `error` column.** Confirmed with the user: a real retry policy for message delivery needs per-recipient delivery confirmation (did *this user* receive it?), which doesn't exist yet and would be designed alongside the subscriber model, not guessed at now. Adding an events table with no writer would be dead weight until that design exists. `error` (nullable text) stays: it's independent of retry, costs nothing, and avoids having to grep worker logs to learn why a job is `failed`. The user's own framing: whether it ends up holding one global error message or a flattened list of per-user failures, "in both cases it's just logs" — an unstructured string, not a structured per-recipient error table. `message_jobs` therefore tracks `status` (reusing the existing `jobStatus` enum), `error`, and timestamps — coarser than `provider_fetch_jobs`/`category_jobs` on purpose (no `retry` counter).
- **One row per `category_job`, not per recipient.** `categoryJobId` is a `unique` FK (mirrors the `files` table's `(categoryJobId, kind, language)` uniqueness pattern, simplified to one dimension since there's no per-recipient or per-language axis yet). Fan-out to individual users is a concern for whichever unit designs the subscriber model.
- **Reuse the existing `jobStatus` pgEnum** (`pending`/`running`/`finished`/`failed`) rather than defining a new enum — `provider_fetch_jobs` and `files`-adjacent tables already share it, and `message_jobs`'s lifecycle is the same shape.
- **Consumer ships with no service dependency.** `MessageConsumer.handleMessage` only parses the message and logs "not implemented" (mirroring today's `ProcessingService.sendMessage` stub) before acking. There is nothing yet for it to claim or update, so wiring a `MessageJobsService` in now would be an abstraction with no callers.
- **New standalone app (`apps/message-worker`), not a second consumer inside `category-worker`.** The explicit goal is decoupling the LLM/report/audio pipeline process from the delivery process; folding the new consumer into the existing worker process would defeat that.

## Open Questions

### Resolved During Planning

- Table name (`message_jobs` vs `delivery_jobs`): resolved with the user, `message_jobs`.
- Whether to add a `message_job_events` table now: resolved with the user, no — retry/attempt tracking is deferred along with the subscriber model.
- Whether `ProcessingService.sendMessage` should insert a `message_jobs` row now: resolved from the user's explicit scope ("pas encore la logique d'envoi") — no.
- Whether to squash the 12 existing migrations before adding this one: resolved with the user — no, generate normally now, squash is a separate concern for the next deploy.
- When to actually apply the migration to a shared database: resolved with the user — outside working hours (~21:00), not immediately.
- Whether `message_jobs` keeps an `error` column without `retry`: resolved with the user — yes, kept; cheap, independent of retry, avoids log-only debugging.
- Queue/env var naming: resolved with the user — `MESSAGE_JOB_QUEUE=message-job` (not the shorter `MESSAGE_QUEUE=message`), for exact symmetry with the `message_jobs` table name and to avoid clashing with `AmqpMessage`/`msg` already used throughout consumer code.
- App name: resolved with the user — `apps/message-worker` (not `message-job-worker`), trading exact table-name symmetry for brevity.
- Whether `apps/message-worker` depends on `@brief/drizzle`: resolved during planning — no, nothing in it touches the database yet.
- Whether to add the `(status, created_at)` index now with no query behind it yet: resolved with the user — yes, add it now for consistency with `category_jobs`/`provider_fetch_jobs`, overriding the planner's initial YAGNI recommendation.

### Deferred to Implementation

- Exact recipient/delivery model (per-user rows, delivery confirmation, retry policy) — blocked on a product decision about subscriptions, out of scope for this plan and for `docs/daily-pipeline-workflow.md` Step 6 as written.
- How `category_jobs` will eventually enqueue a `message_jobs` row (inside `completeStep`'s `SENDING_MESSAGE` transition, or a new step) — deferred until the delivery logic itself is designed.

## Implementation Units

- [x] **Unit 1: Add `message_jobs` table to the schema**

**Goal:** Model the new sub-job as a table linked 1:1 to `category_jobs`.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `db/drizzle/src/db/schema.ts`

**Approach:**
- Add `messageJobs = pgTable("message_jobs", ...)` with: `id` (serial PK), `categoryJobId` (integer, not null, `references(() => categoryJobs.id, { onDelete: "cascade" })`, `unique`), `status` (reuse `jobStatus` enum, not null), `error` (text, nullable), `createdAt`/`updatedAt` (`timestamp` with `withTimezone`, matching existing convention), `finishedAt` (nullable timestamp).
- No `retry` column (see Key Technical Decisions) — no check constraint tying `error` to `failed` status either, since without a retry loop there's no single moment that reliably sets both together yet.
- Add `messageJobs` to the `defineRelations` tables map, with a `r.one.categoryJobs` relation from `messageJobs.categoryJobId` to `categoryJobs.id`, and the inverse `messageJob: r.one.messageJobs(...)` added under `categoryJobs`'s relation entry.
- Add an index on `(status, createdAt)` mirroring `category_jobs_status_created_at_idx` for consistency with the other two job tables, since the same "find pending jobs" query shape will likely be needed once claiming is implemented.

**Patterns to follow:**
- `files` table (`db/drizzle/src/db/schema.ts:328`) for the direct-child-of-`categoryJob` FK/cascade shape.
- `providerFetchJobs`/`categoryJobs` for the `status`/timestamp column conventions and the `defineRelations` wiring style.

**Test scenarios:**
- Test expectation: none — pure schema definition, no runtime behavior. Correctness is verified by Unit 2 (migration generation) and by TypeScript compilation picking up the new `schema.messageJobs` export.

**Verification:**
- `schema.messageJobs` is exported and typed; `db.query.categoryJobs.findFirst({ with: { messageJob: true } })` type-checks.

---

- [x] **Unit 2: Generate and apply the Drizzle migration** *(superseded — see note below: the user asked to squash the 12 historical migrations immediately rather than at the next deploy, so `message_jobs` shipped as part of one fresh initial migration, applied now rather than at ~21:00)*

**Goal:** Produce and validate the SQL migration for `message_jobs`.

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Create: `db/drizzle/drizzle/<generated-timestamp>_<generated-name>/migration.sql`
- Create: `db/drizzle/drizzle/<generated-timestamp>_<generated-name>/snapshot.json`

**Approach:**
- Run `pnpm drizzle:generate` from the repo root (wraps `drizzle-kit generate` with `.env` loaded, per `package.json`). The generated migration is additive-only and incremental — the historical-migration squash `docs/daily-pipeline-workflow.md` describes is a separate, later concern (at the next deploy/"mise en production"), not a blocker for this plan.
- Review the generated SQL: confirm the FK to `category_jobs`, the `unique` constraint on `category_job_id`, the enum reuse (no duplicate `job_status` enum creation), and the new index.
- Apply it with `pnpm drizzle:migrate` outside working hours (user's stated preference — target ~21:00 local time rather than mid-morning) and confirm the table exists.

**Patterns to follow:**
- Any recent migration folder (e.g. `db/drizzle/drizzle/20260803131825_quiet_tarot/`) for what a generated `migration.sql`/`snapshot.json` pair looks like — this is drizzle-kit-generated, not hand-written.

**Test scenarios:**
- Test expectation: none — migration correctness is verified by applying it to a real local Postgres instance and inspecting the resulting table/constraints, not by an automated test (consistent with how the existing 12 migrations in this repo are verified).

**Verification:**
- `\d message_jobs` in `psql` shows the expected columns, the FK with `ON DELETE CASCADE`, the unique constraint on `category_job_id`, and the `(status, created_at)` index.
- `pnpm drizzle:generate` run a second time produces no further diff (schema and migration are in sync).

---

- [x] **Unit 3: Add the `message_job` AMQP message contract**

**Goal:** Give the new queue a typed, validated message shape, consistent with the other two job queues.

**Requirements:** R3

**Dependencies:** None (independent of Units 1–2; needs no DB access)

**Files:**
- Create: `packages/infra/src/amqp/messageJob.ts`
- Modify: `packages/infra/src/amqp/index.ts`

**Approach:**
- Mirror `packages/infra/src/amqp/providerFetchJob.ts` exactly: `messageJobMessageSchema = z.object({ id: z.number() })`, `type MessageJobMessage`, `safeParseMessageJobMessage(raw: Buffer)` using `safeParseJson`.
- Add `export * from "./messageJob.js";` to `packages/infra/src/amqp/index.ts`.

**Patterns to follow:**
- `packages/infra/src/amqp/providerFetchJob.ts` and `packages/infra/src/amqp/category.ts` (both are ~15-line files with the same shape).

**Test scenarios:**
- Test expectation: none — `category.ts` and `providerFetchJob.ts` have no accompanying tests either; this repo doesn't test the AMQP parser helpers directly, and there's no reason to start an inconsistent convention for the third one.

**Verification:**
- `safeParseMessageJobMessage(Buffer.from('{"id":1}'))` returns `{ success: true, data: { id: 1 } }`; malformed input returns `{ success: false }` without throwing.

---

- [x] **Unit 4: Scaffold the `message-worker` app**

**Goal:** A standalone consumer process that connects to `MESSAGE_JOB_QUEUE`, structurally identical to the existing workers, with a stub `handleMessage`.

**Requirements:** R3, R4

**Dependencies:** Unit 3 (needs `safeParseMessageJobMessage`); independent of Units 1–2 (does not touch `message_jobs` rows yet)

**Files:**
- Create: `apps/message-worker/package.json`
- Create: `apps/message-worker/tsconfig.json`
- Create: `apps/message-worker/src/config/env.ts`
- Create: `apps/message-worker/src/consumer.ts`
- Create: `apps/message-worker/src/index.ts`
- Modify: `.env.example` (add `MESSAGE_JOB_QUEUE=message-job`)

**Approach:**
- `package.json`: copy `apps/category-worker/package.json`, rename to `@brief/message-worker`, drop the `job:run` script (there is no `runCategoryJob`-equivalent script to add yet), and drop the `@brief/services` **and** `@brief/drizzle` dependencies — nothing in this app touches the database yet (`src/index.ts` doesn't import `db`, see below), so keeping either would be dead weight. Both get added back in whichever future unit wires a `MessageJobsService`.
- `tsconfig.json`: identical to `apps/category-worker/tsconfig.json`.
- `src/config/env.ts`: `{ WORKER_ID, AMQP_URL, MESSAGE_JOB_QUEUE }`, same zod-parse pattern as the other two workers.
- `src/consumer.ts`: `MessageConsumer extends BaseAmqpConsumer`. `handleMessage` calls `safeParseMessageJobMessage(msg.content)`; on parse failure, log and `channel.nack(msg, false, false)` (matches `CategoryConsumer`); on success, log `"message delivery is not implemented, skipping"` with the parsed `id` and `channel.ack(msg)`. No constructor-injected services.
- `src/index.ts`: build the consumer with `env.WORKER_ID`, `env.AMQP_URL`, `env.MESSAGE_JOB_QUEUE`, `"message-job"` as the worker name (matches the `name === queue` convention `CategoryConsumer`/`ProviderFetchConsumer` already follow — `"category"` for `CATEGORY_QUEUE`, `"provider-fetch"` for `PROVIDER_FETCH_QUEUE`); call `consumer.init()`; wire `SIGTERM`/`SIGINT` graceful shutdown exactly like `apps/category-worker/src/index.ts`. No `db` import needed since nothing queries the database yet — simpler than `category-worker/src/index.ts` in that respect.

**Patterns to follow:**
- `apps/category-worker/src/{index.ts,consumer.ts,config/env.ts}` and `apps/providerFetch-worker/src/{index.ts,consumer.ts,config/env.ts}` for structure; `apps/category-worker/src/consumer.ts`'s parse-failure branch for the nack-on-bad-message behavior.

**Test scenarios:**
- Test expectation: none — no existing worker (`category-worker`, `providerFetch-worker`) has consumer tests in this repo; consistent with that convention, and there's no business logic here yet to test.

**Verification:**
- `pnpm --filter @brief/message-worker dev` connects to the broker, asserts the `message-job`/`message-job.dlx`/`message-job.dlq` topology (visible via `assertQueueTopology`'s calls), and stays running without crashing.
- Publishing `{"id": 1}` to the `message-job` queue by hand produces the "not implemented" log line and the message is acked (does not requeue or dead-letter).
- Publishing malformed JSON to the `message-job` queue results in the message being dead-lettered (nacked without requeue).

---

- [x] **Unit 5: Sync `docs/daily-pipeline-workflow.md`**

**Goal:** Keep the pipeline's authoritative contract document from going stale now that one of the tables it explicitly calls out as not-yet-existing, partially exists.

**Requirements:** R1 (documentation of R1's outcome)

**Dependencies:** Unit 1

**Files:**
- Modify: `docs/daily-pipeline-workflow.md`

**Approach:**
- Add a row for `message_jobs` to the "Table responsibilities" list, described as an empty per-category-job delivery placeholder (not yet populated or claimed by anything).
- In "Step 6: distribute the result", add a short note that `message_jobs` exists as an empty scaffold with its own consumer (`message-worker`), but the subscriber/delivery model, the enqueue-on-`sending_message` wiring, and any retry policy are still undesigned — do not imply more is done than actually is.
- Explicitly note that `message_jobs` has no `retry` column and no `message_job_events` table by deliberate choice (retry needs per-recipient delivery confirmation, which needs the undesigned subscriber model), not by oversight — this is the note the Risks & Dependencies section below relies on to prevent a future implementer from assuming it's missing sibling-table parity by accident.

**Patterns to follow:**
- The document's existing terse, present-tense, contract-style prose (e.g. how `files` is described in the table).

**Test scenarios:**
- Test expectation: none — documentation change only.

**Verification:**
- A future reader of Step 6 is not misled into thinking delivery works; the table list matches `schema.ts` exactly.

## System-Wide Impact

- **Interaction graph:** None yet — `apps/message-worker` is not started by anything, not published to by anything, and `category_jobs`'/`ProcessingService`'s behavior is unchanged. The only new runtime actor is the `message-worker` process itself, idle until manually fed a message.
- **Error propagation:** N/A for this plan — the stub `handleMessage` either acks (parse success) or dead-letters (parse failure); there is no downstream failure mode yet because there is no downstream work.
- **State lifecycle risks:** The `message_jobs.category_job_id` unique + `onDelete: "cascade"` means deleting a `category_job` silently deletes its `message_jobs` row too — same behavior as `files`, intentional and consistent.
- **API surface parity:** None — no HTTP/API surface touches this table yet.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Migration touches a shared dev/prod Postgres schema | Additive-only migration (new table, no column changes to existing tables); reviewed generated SQL before applying (Unit 2); reversible via a down-migration or table drop since no data exists in it yet. |
| A future implementer assumes `message_jobs` already has retry/error columns because sibling job tables do | Explicitly documented in Key Technical Decisions and in the new `docs/daily-pipeline-workflow.md` note (Unit 5) that this was a deliberate, confirmed omission, not an oversight. |
| New app adds workspace/deploy surface (another process to run in every environment) with zero functional payoff today | Scope explicitly limited to "the base" per the user's request; deploy/process-manager wiring is out of scope and was not found to exist for the other two workers either (no Dockerfile in the repo), so nothing new is owed here. |

## Execution Note (post-plan)

Two things changed during execution, superseding the "Resolved During Planning" entries above:

- **Migration timing:** the user asked to run the migration immediately rather than wait until ~21:00, then explicitly declined a request to disguise the actual execution time in the migration folder's timestamp — it was applied at its real time.
- **Squash timing:** the user then asked to squash the 12 historical migrations immediately rather than at the next deploy ("on squashera quand on fera une mep" → superseded by "squash les migrations"). The 12 old migration folders plus the standalone `message_jobs` migration were removed and replaced by one fresh initial migration (`db/drizzle/drizzle/20260805112351_jazzy_gressill/`) generated from the current `schema.ts`, including `message_jobs`. All removed folders were already committed in git history, so nothing was lost.
- **Dev DB reconciliation:** applying `drizzle:migrate` surfaced that the local dev database's schema had been built via `drizzle:push` (no migration-history tracking) rather than `drizzle:migrate`, so `drizzle.__drizzle_migrations` was empty and out of sync with reality. The user chose a full reset: all tables/types dropped, then the fresh squashed migration applied to the now-empty database. `drizzle.__drizzle_migrations` now correctly tracks exactly one applied migration. Any pre-existing local dev data (categories/providers/articles, if any) was lost — accepted by the user as part of the reset.

## Sources & References

- **Origin document:** `docs/daily-pipeline-workflow.md`
- Related code: `db/drizzle/src/db/schema.ts`, `apps/category-worker/src/`, `apps/providerFetch-worker/src/`, `packages/infra/src/amqp/`, `packages/services/src/modules/processing/processing.service.ts` (`sendMessage` stub), `packages/services/src/modules/categoryJobs/categoryJobs.service.ts`
