# Brief: Domain and Data Flow

## Purpose

Brief fetches articles from configured providers each morning, produces one summary per category, converts the summary to audio, and later distributes the result to subscribers.

The current work focuses on the database schema. Application services and workers still reflect parts of the previous model and will be updated later.

See [`docs/daily-pipeline-workflow.md`](docs/daily-pipeline-workflow.md) for the implementation contract, transaction boundaries, retry rules, and worker sequence.

## Daily pipeline

### 1. Plan the daily run

The scheduler loads the categories and their enabled providers. For each category, it creates one `category_job` for the target date with:

- `status = waiting_for_providers`
- `state = creating_report`

The scheduler creates one `provider_fetch_job` per distinct `(providerId, targetDate)`. Categories that share a provider also share that provider's fetch job.

`category_job_provider_fetch_jobs` records the exact fetch jobs required by each category job. This table is a snapshot of the dependencies for that daily run. Later changes to `category_providers` must not change an existing job's dependencies.

The scheduler should create the category jobs, provider fetch jobs, and dependency rows in one database transaction. It then publishes each provider fetch job ID to RabbitMQ.

### 2. Fetch provider articles

A provider worker claims a `provider_fetch_job`, fetches the provider's latest articles, and stores them in `articles`. The unique `(providerId, url)` constraint deduplicates articles.

`provider_fetch_job_articles` records every article observed during the fetch. A previously stored article can therefore belong to more than one fetch job without creating another `articles` row.

After the fetch finishes, the worker marks the provider fetch job as `finished`. It follows `category_job_provider_fetch_jobs` to find the waiting category jobs that depend on it.

When every required provider fetch job has finished, one worker atomically changes the category job from `waiting_for_providers` to `pending`. Only the worker that performs this transition publishes the category job ID to RabbitMQ.

### 3. Select articles and create the summary

The category worker claims a pending category job and reads the candidate articles through:

```text
category_jobs
  -> category_job_provider_fetch_jobs
  -> provider_fetch_jobs
  -> provider_fetch_job_articles
  -> articles
```

The LLM selects the relevant articles and creates the summary.

- `category_jobs.summary` stores the generated text.
- `category_job_articles` stores the selected articles.
- `category_job_articles.rank` preserves their order within the summary.

The schema rejects duplicate articles and duplicate ranks within the same category job.

### 4. Create the audio

The category job moves to `creating_audio`. An external text-to-speech service converts the summary into audio.

`files` stores the uploaded object metadata. The unique `(categoryJobId, kind, language)` constraint allows one audio file per language for a category job. The current schema supports French and English audio files.

### 5. Distribution

The category job moves to `sending_message` before distribution.

Users and their category subscriptions now exist (`user`, `subscriptions`), so the database can answer "who wants this category?". What still does not exist is the delivery step itself: `message_jobs` remains one row per category job with no fan-out to recipients, `message-worker` still logs "not implemented", and nothing reads `subscriptions` from the pipeline yet.

## Job status and state

Provider fetch jobs use these statuses:

```text
pending -> running -> finished
                   -> failed
```

Category jobs add an initial dependency gate:

```text
waiting_for_providers -> pending -> running -> finished
                                         -> failed
```

The category job state tracks the current processing step:

```text
creating_report -> creating_audio -> sending_message
```

`category_jobs` and `provider_fetch_jobs` hold the current status, retry count, latest error, and completion timestamp. `category_job_events` and `provider_fetch_job_events` record individual attempts for audit and retry diagnostics.

## Data model

- `categories`: category definitions. IDs use UUIDv7.
- `providers`: provider configuration, fetch limit, enabled flag, and last fetch timestamp. IDs use UUIDv7.
- `category_providers`: current many-to-many provider assignment for categories.
- `articles`: deduplicated provider articles. IDs use UUIDv7.
- `category_jobs`: one category pipeline run per `(categoryId, targetDate)`.
- `provider_fetch_jobs`: one provider fetch run per `(providerId, targetDate)`.
- `category_job_provider_fetch_jobs`: immutable dependency snapshot between a category run and its provider fetches.
- `provider_fetch_job_articles`: articles observed by a provider fetch.
- `category_job_articles`: articles selected by the LLM, with their summary order.
- `provider_fetch_job_events`: provider fetch attempt history.
- `category_job_events`: category processing attempt history, including the processing state.
- `files`: uploaded audio metadata for a category job and language.
- `user`, `account`, `verification`: owned by Better Auth. Singular names and `text` primary keys on purpose — these are the library's tables, not domain entities. `user` also carries the `admin` plugin's `role`, `banned`, `ban_reason` and `ban_expires` columns; only `role` is used today.
- `subscriptions`: which categories a user wants briefs for. Composite primary key `(user_id, category_id)`, cascading both ways.

There is deliberately **no `session` table**: sessions live in Redis as Better Auth's secondary storage. Two failure modes follow, and they are not the same. If Redis comes back empty (lost persistence, `FLUSHDB`, `maxmemory` eviction), the sessions are gone and everyone is logged out — a clean 401. If Redis becomes unreachable, session reads throw instead (`enableOfflineQueue: false` in `packages/infra/src/redis/index.ts`), so authenticated server functions answer 500, not 401. This is accepted: Redis down means the app is down, and a 500 is non-destructive — the session cookie survives, so the app recovers on its own once Redis is back. The 5-minute `cookieCache` delays the effect, with active users failing one by one as their cached cookie expires rather than all at once.

Category and provider IDs use UUIDv7. Job IDs remain serial integers because RabbitMQ messages carry job IDs and the jobs are internal processing records.

## Integrity rules

- An article URL is unique within a provider.
- A category has at most one category job per target date.
- A provider has at most one fetch job per target date.
- A dependency can appear only once for a category job.
- An observed article can appear only once for a provider fetch job.
- A selected article can appear only once for a category job.
- A selected article rank is unique within a category job and cannot be negative.
- A finished or failed job must have `finishedAt`; other job statuses must not have it.
- A failed job must contain an error.
- A category job can have at most one file for each `(kind, language)` pair.
- Pending-job indexes support queue polling by creation time.

## RabbitMQ delivery and the outbox option

The schema does not contain an outbox table yet.

Without an outbox, a process can commit a job state change and crash before publishing the corresponding RabbitMQ message. An outbox would store the message in PostgreSQL in the same transaction as the state change. A separate publisher would send stored events and mark them as published.

Consumers must remain idempotent even with an outbox because a crash after RabbitMQ accepts a message but before PostgreSQL records `publishedAt` can cause a retry.

Add an outbox when the project requires crash-safe RabbitMQ publication. A generic outbox could carry events such as `provider_fetch_job.created` and `category_job.ready`.

## Applications

- `apps/web`: TanStack Start. The only HTTP entry point, and the whole server layer — endpoints are **server functions**, not routes. Replaced `apps/hono` and the `apps/react` template, both removed.
- `apps/scheduler`, `apps/providerFetch-worker`, `apps/category-worker`, `apps/message-worker`: the pipeline processes.

Better Auth runs **headless** in `apps/web`: its HTTP handler is never mounted, `AuthService` in `packages/services` wraps `auth.api.*`, and `apps/web/src/libs/server/headers.ts` moves session cookies by hand. A consequence worth knowing: the `admin` plugin's endpoints (list users, set role, ban, impersonate) are reachable at no URL at all.

Headless has a price on the other side: Better Auth's rate limiting lives in the router it never mounts, so `auth.api.*` runs the hooks but none of the router-level protections. `apps/web/src/libs/server/rate-limit.ts` replaces it with Redis counters (`INCR` + `EXPIRE NX`, fixed window) on the four server functions that cost something to call — sign-in, sign-up, password reset, verification resend — keyed on both the client IP and the email. It fails closed: a Redis outage rejects those calls, which is coherent since sessions live in Redis anyway.

Auth secrets are parsed by `apps/web/src/config/env.ts` and injected through constructors — deliberately **not** added to `packages/infra/src/configs/env.ts`, which parses at import time for every worker and would stop them booting.

The same boundary holds inside `packages/services`: `auth` and `mail` are **not** re-exported from `src/index.ts`. They live behind the `@brief/services/auth` and `@brief/services/mail` subpaths, because the barrel is what every worker imports, and `export *` there makes Node load `better-auth` and `resend` at boot just to reach a pipeline service. Only `apps/web` imports the subpaths.

`packages/infra` is now only what more than one process needs: `amqp`, `configs`, `errors`, `libs` (pino), and `redis`. The HTTP-shaped modules that came with `apps/hono` — `factories`, `middlewares`, `schemas`, `helpers`, `types` — are gone, along with the `hono*` dependencies and the root barrel that re-exported them. Every consumer imports a subpath (`@brief/infra/errors`, `/libs`, `/amqp`, `/redis`, `/configs`), so the package deliberately has **no `.` export**: a barrel there would make a worker load every module to reach one. The `create-hono-endpoint` skill became `.claude/skills/create-server-function`, which documents the server-function workflow that replaced it.

## Current boundaries

- Services and workers have not been adapted to this schema yet.
- Users, roles, and category subscriptions exist; delivery and per-recipient fan-out do not. A reader can now authorise Telegram — `telegram_pairings` holds the proven `chat_id` and the opt-in evidence — but nothing sends to it yet, and `message_jobs.category_job_id` being unique still blocks per-recipient fan-out.
- No admin surface: the role exists and is enforceable, but nothing reads it and there is no script to promote a user to `admin` yet.
- The site copy names Telegram as the delivery channel (`hero.rhythm`, `closing.note`, `method.page.details`, `auth.topics.lead` in the i18n dictionaries), which nothing delivers on yet: a reader who pairs receives no brief until the fan-out lands. Email is now only the account address — sign-in, verification, password reset.
- The schema records the selected articles but does not version summaries or previous selections across retries.
- The schema does not enforce that linked category and provider jobs share the same target date. The scheduler must create valid dependency rows.
- The schema does not enforce that an article linked to a fetch job belongs to the same provider. The ingestion code must preserve that invariant.
- Historical migrations can be discarded. Generate a new initial migration after the schema settles; no existing database data needs migration.
