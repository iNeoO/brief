# Daily Pipeline Workflow

## Scope

This document defines the implementation contract for the daily article pipeline. The database schema already represents this contract. Services, workers, and RabbitMQ publishers will adopt it in later changes.

The pipeline must:

- create one category run per category and date;
- fetch each provider once per date, even when several categories use it;
- wait for every required fetch before starting a category run;
- preserve the articles returned by each fetch;
- preserve the articles selected by the LLM;
- support retries without creating duplicate jobs or links.

## Terms

### Category job

A `category_job` represents the complete summary pipeline for one category and one `targetDate`. It starts while provider fetches are outstanding, then runs the report, audio, and delivery steps.

### Provider fetch job

A `provider_fetch_job` represents one provider fetch for one `targetDate`. Several category jobs can depend on it.

### Candidate article

A candidate article is an article observed by one of the provider fetch jobs attached to a category job. `provider_fetch_job_articles` records this set.

### Selected article

A selected article is a candidate that the LLM used in the summary. `category_job_articles` records the selected set and its order.

## Table responsibilities

| Table | Responsibility |
| --- | --- |
| `categories` | Defines summary categories. |
| `providers` | Configures article sources and enables or disables fetching. |
| `category_providers` | Defines the current provider assignment for each category. |
| `articles` | Stores deduplicated article content. |
| `category_jobs` | Stores one category pipeline run per date, and the LLM tokens it spent. |
| `provider_fetch_jobs` | Stores one provider fetch run per date. |
| `category_job_provider_fetch_jobs` | Freezes the fetch dependencies of a category run. |
| `provider_fetch_job_articles` | Records every article observed during a fetch. |
| `category_job_articles` | Records the articles selected by the LLM and their order. |
| `provider_fetch_job_events` | Records provider fetch attempts. |
| `category_job_events` | Records category processing attempts and states. |
| `files` | Stores uploaded audio metadata. |
| `message_jobs` | One delivery of one category job to one reader, with its own status, retry counter and `is_first` flag. |
| `message_announcements` | Which reader has already had the day's opening line, and on which target date. |

## Why both article link tables exist

The two article link tables answer different questions.

`provider_fetch_job_articles` answers:

> Which articles did this provider fetch return?

The application cannot reconstruct this set from `articles.publishedAt` with full accuracy. A feed can return an older article, omit a publication date, or return an article that already exists in the database. `articles.createdAt` records the first insertion and does not record later observations.

`category_job_articles` answers:

> Which candidate articles did the LLM retain, and in what order?

The category worker writes this table after the LLM response. The primary key prevents duplicate articles. The `(categoryJobId, rank)` constraint preserves one deterministic order.

## Step 1: schedule the daily run

The scheduler chooses one calendar `targetDate`. Every job created by the run must use that value. The scheduler must use an agreed application timezone when it derives the date.

It loads all categories and their enabled providers, then performs the following work in one PostgreSQL transaction:

1. Insert one `category_job` per category with `status = waiting_for_providers` and `state = creating_report`.
2. Insert one `provider_fetch_job` per distinct provider with `status = pending`.
3. Reuse an existing job when `(providerId, targetDate)` already exists.
4. Insert every required row into `category_job_provider_fetch_jobs`.
5. Commit only after all dependency rows exist.

The unique constraints on category/date and provider/date make the scheduling operation idempotent.

The dependency rows form a snapshot. If someone changes `category_providers` after scheduling, the change affects future runs and leaves the current run unchanged.

### Empty categories

The scheduler must choose a policy for a category with no enabled providers. The recommended policy marks its category job as `failed` with a clear error. It must not move an empty job to `pending` by treating an empty dependency set as complete.

### RabbitMQ publication

After the transaction commits, the scheduler publishes one message per new provider fetch job:

```json
{ "id": 123 }
```

The consumer must tolerate duplicate messages. It claims a job only when its current status allows the transition.

## Step 2: fetch a provider

The provider worker receives a provider fetch job ID and performs these operations:

1. Atomically claim the job by changing `pending` to `running`.
2. Load the provider configuration from `provider_fetch_jobs.providerId`.
3. Fetch the provider feed with its configured `fetchLimit`.
4. Canonicalize each article URL.
5. Insert articles with conflict handling on `(providerId, url)`.
6. Resolve the IDs of both new and previously stored articles returned by the feed.
7. Insert those IDs into `provider_fetch_job_articles`.
8. Mark the fetch job as `finished` and set `finishedAt`.

The worker should write the articles, observation links, and final job status in a transaction after the external fetch succeeds. A retry can repeat the inserts because both article and link constraints are idempotent.

### Fetch failure

On failure, the worker records an event with the attempt number and error. It either returns the job to `pending` or marks it `failed` after the retry limit. A terminal failure sets `finishedAt` because the job reached a terminal status.

A returned job is not requeued with `nack(requeue = true)`, which would spend every attempt within seconds against a feed that has just failed to answer. The message is republished to `provider-fetch.retry`, the holding queue described under [Delivery failures](#delivery-failures), with the delay for the attempt that just failed taken from `PROVIDER_FETCH_RETRY_DELAYS_MS`. Those delays are the shortest of the three: the category jobs depending on this fetch stay in `waiting_for_providers` until it finishes.

A failed provider fetch keeps dependent category jobs in `waiting_for_providers`. A later implementation may propagate a terminal failure to those category jobs, but it must not generate a partial summary without an explicit product decision.

## Step 3: release ready category jobs

After a provider fetch finishes, the worker finds category jobs linked through `category_job_provider_fetch_jobs`.

For each waiting category job, it executes one conditional update equivalent to:

```sql
UPDATE category_jobs AS category_job
SET status = 'pending'
WHERE category_job.id = :category_job_id
  AND category_job.status = 'waiting_for_providers'
  AND EXISTS (
    SELECT 1
    FROM category_job_provider_fetch_jobs AS dependency
    WHERE dependency.category_job_id = category_job.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM category_job_provider_fetch_jobs AS dependency
    JOIN provider_fetch_jobs AS fetch_job
      ON fetch_job.id = dependency.provider_fetch_job_id
    WHERE dependency.category_job_id = category_job.id
      AND fetch_job.status <> 'finished'
  )
RETURNING category_job.id;
```

The `waiting_for_providers` predicate resolves the race between the last provider workers. One worker receives the returned row and publishes the category job ID. Other workers update no rows.

## Step 4: build the summary

The category worker claims a `pending` category job by changing it to `running`. It loads candidate articles through the frozen dependency graph:

```text
category_jobs
  -> category_job_provider_fetch_jobs
  -> provider_fetch_jobs
  -> provider_fetch_job_articles
  -> articles
```

The query should use the dependency graph instead of filtering all provider articles by `publishedAt`. The graph reproduces the exact input returned by the daily fetches.

The worker sends the candidates to the LLM. After a valid response, it stores:

- the summary in `category_jobs.summary`;
- each selected article in `category_job_articles`;
- the LLM order as a zero-based `rank`.

The summary and selected-article rows should share one transaction. A retry should replace the previous selection for that category job before inserting the new ordered selection. The current schema keeps the latest result and does not version past summaries.

The worker then changes `state` from `creating_report` to `creating_audio` and resets step-level retry data according to the retry policy.

### What the run cost

Both model calls of this step report their token usage through a `chat()` middleware, which sums the `onUsage` hook across the run's iterations — the run's own `RUN_FINISHED` carries the last iteration only, so reading it would price a four-turn agent loop at the cost of its fourth turn. The middleware logs `promptTokens`, `completionTokens`, `totalTokens` and `iterations` at `info` under `llm usage`, and each call's totals are added to `category_jobs`.

The figures are added, never set: the selection and the summary are two calls, and a retried step pays for its calls again. They are written as soon as each call returns, before the guard that fails a job with no usable selection, so a job that dies halfway still shows what it spent. A failure to record usage is logged and swallowed — bookkeeping must not fail a brief that was already paid for.

`iterations` is the second half of the answer. A call that quietly ran out of agent-loop turns reads as a round number against its own ceiling, long before the summary it produced looks odd.

## Step 5: create audio

The worker sends `category_jobs.summary` to the text-to-speech provider. It uploads each generated file and upserts one `files` row per `(categoryJobId, kind, language)`.

The unique constraint makes audio generation idempotent at the metadata level. The object storage key must also remain stable or the worker must delete replaced objects.

After all requested languages exist, the worker changes the state to `sending_message`.

### Category job failure

A failure anywhere in steps 4 to 6 records an event with the attempt number and the error, then either returns the job to `pending` or marks it `failed` at `MAX_JOB_RETRY`. A few error codes are terminal on the first attempt — an unknown state, a missing category, a missing audio file — because a second attempt cannot change the answer.

A returned job is not requeued with `nack(requeue = true)`, which would replay the LLM and the text-to-speech within seconds of the failure and burn every attempt against a rate limiter that has just said no. The message is republished to `category.retry`, the same holding-queue shape the message worker uses, with the delay for the attempt that just failed taken from `CATEGORY_RETRY_DELAYS_MS`. The attempt count lives on `category_jobs.retry`, because a republished message carries no history.

The fan-out of step 6 uses the same holding queue when it cannot publish, so a queue that is briefly down does not spin the worker against a job that is already `finished`.

## Step 6: distribute the result

Delivery is per reader and per topic, and it happens **after** the category job is finished — never from inside `sending_message`, whose only remaining job is to verify that the run produced a summary and an audio file (see Step 5).

The category worker publishes; `apps/message-worker` sends.

1. `markFinished` moves the category job to `finished` and sets `finishedAt`. The brief is now published on the site.
2. The category worker inserts one `message_jobs` row per subscriber of that category whose `telegram_pairings.status` is `verified` and whose `user.banned` is false, with `on conflict do nothing`.
3. It then selects **every** row for that category job still `pending` — not only the ones it just inserted — and publishes one `{ "id": <message_job_id> }` per row. Selecting only the fresh inserts would leave a half-failed fan-out unrepairable: rows created but never published would sit `pending` for ever.
4. The fan-out also runs on the redelivery path, when `claimJob` returns nothing because the job is already `finished`. That is what closes the crash window between step 1 and step 3.
5. The fan-out refuses a job that is not `finished` or whose `targetDate` is not today, wherever it is called from — including the manual `--deliver` replay.

The message worker claims a row (`pending` → `running`), re-reads the pairing at that moment, decides whether this delivery carries the day's opening line, and calls `sendAudio` with a link to `/api/briefs/audio/$fileId`.

### Delivery failures

| Telegram answer | Effect |
| --- | --- |
| `429` | Wait the `retry_after` it gives, then retry |
| `5xx`, timeout, network error | Retry with a growing delay |
| `403`, `400 chat not found` | End the pairing (`opted_out`), fail the job, acknowledge |
| any other `400` | Fail the job, dead-letter |

Retries do not use `nack(requeue = true)`, which would spin. The message is republished to `message-job.retry`, a queue with no consumer whose messages dead-letter back into `message-job` once their own `expiration` elapses — the same mechanism the category worker uses. The delay is carried per message so a 429's own figure can be honoured. The attempt count lives on `message_jobs.retry`, because a republished message carries no history; at `MAX_JOB_RETRY` the job is marked `failed` and dead-lettered.

The message worker runs with `prefetch = 1`: Telegram allows roughly one message per second to the same chat, and concurrent deliveries to one reader would race into a 429.

## Retry and idempotency rules

- RabbitMQ uses at-least-once delivery. Every consumer must accept duplicate messages.
- A worker claims a job with a conditional status update. A message for an already claimed or completed job becomes a no-op.
- A retryable failure is deferred through the queue's `.retry` holding queue, never redelivered immediately.
- Scheduling relies on unique category/date and provider/date constraints.
- Article insertion relies on `(providerId, url)`.
- Fetch observation links and selected-article links use composite primary keys.
- Terminal `finished` and `failed` statuses require `finishedAt`.
- A `failed` status requires an error.

Event tables record attempt history. Current job rows keep the latest operational state used for claims and transitions.

## Outbox decision

The first implementation can publish RabbitMQ messages after committing database transactions. This leaves a crash window between the commit and publication.

Add a PostgreSQL outbox when the pipeline needs crash-safe publication. The transaction that creates or releases a job would also insert an outbox event. A separate publisher would send the event to RabbitMQ and record `publishedAt`.

An outbox prevents permanent message loss after a successful database commit. It does not remove duplicate delivery, so consumers still need idempotent claims.

The current schema does not include an outbox table.

## Database reset and migration

The project does not need to preserve data from the previous schema. Once this model settles:

1. Remove the historical Drizzle migrations.
2. Generate one new initial migration from `schema.ts`.
3. Review the generated SQL for UUIDv7 defaults, enums, foreign keys, checks, and partial indexes.
4. Apply the migration to an empty database.
5. Run integration tests against PostgreSQL before implementing the workers.

## Implementation sequence

Implement later application work in this order:

1. Daily scheduler transaction and provider-job publication.
2. Provider worker claim, ingestion, article observation links, retries, and completion.
3. Category readiness transition and RabbitMQ publication.
4. Category worker candidate query, LLM summary, and selected-article persistence.
5. Audio generation and file upsert.
6. Subscriber and delivery model.
7. Outbox if operational requirements call for crash-safe publication.

## Invariants enforced by application code

The schema does not enforce every cross-table rule. Application transactions must preserve these invariants:

- A category job and each linked provider fetch job use the same `targetDate`.
- A provider fetch job belongs to a provider assigned to the category when the scheduler creates the snapshot.
- An article linked to a provider fetch job belongs to the same provider.
- A selected article belongs to the candidate set of the category job.
- The scheduler inserts the complete dependency set before committing.
