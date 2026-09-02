# brief

## Stack

- **App**: TanStack Start (React 19 · TanStack Router · TanStack Query · Mantine) — `http://localhost:3000`
- **Pipeline**: scheduler + RabbitMQ workers (provider fetch · category · message)
- **ORM**: Drizzle — PostgreSQL
- **Infra**: Redis (sessions, rate limiting) · RabbitMQ (jobs) · Garage (S3-compatible audio storage)
- **Tooling**: pnpm workspaces · TypeScript · Biome · Vitest

`apps/web` is the only HTTP entry point. Endpoints are **server functions**, not routes —
there is no separate backend app and no REST API.

## Prerequisites

- [Node.js](https://nodejs.org) ≥ 20
- [pnpm](https://pnpm.io) ≥ 11
- [Docker](https://www.docker.com)

## First-time setup

```bash
cp .env.example .env   # configure credentials
docker compose up -d   # start PostgreSQL, Redis, RabbitMQ, Garage
pnpm garage:init       # create the S3 bucket and access keys
pnpm drizzle:push      # apply schema to DB
pnpm dev               # build libs + start the app
```

## Commands

### Quality gates

Run across every workspace package, in dependency order.

| Command | Description |
| --- | --- |
| `pnpm check` | The full gate: lint → build → typecheck → test |
| `pnpm lint` | `biome check` in every package |
| `pnpm lint:fix` | Same, applying the safe fixes |
| `pnpm typecheck` | `tsc --noEmit` in every package (needs the libs built) |
| `pnpm test` | Every package's test suite |
| `pnpm build` | Build every package topologically |

### Development

| Command | Description |
| --- | --- |
| `pnpm dev` | Build the libs and start the app |
| `pnpm dev:all` | Same, plus the workers and the scheduler |
| `pnpm web:dev` | Start the app alone (libs must be built) |
| `pnpm workers:dev` | Start the three workers |
| `pnpm scheduler:dev` | Start the scheduler |
| `pnpm dev:libs:build` | Rebuild `common`, `infra`, `drizzle`, `services` |
| `pnpm services:test` | Run the service tests |
| `pnpm drizzle:push` | Push schema changes to the DB |
| `pnpm drizzle:generate` | Generate migration files |
| `pnpm drizzle:migrate` | Run pending migrations |
| `pnpm drizzle:seed` | Seed reference data |

The workspace packages are consumed as built `dist`, so rebuild them
(`pnpm dev:libs:build`) after changing one and before typechecking `apps/web`.
For the same reason `pnpm check` builds before it typechecks — running
`pnpm typecheck` on a clean checkout fails until the libs have a `dist`.

## Production

`docker-compose.prod.yaml` runs the whole app: the web server, the scheduler,
the three workers, and a `db-migrate` one-shot that applies the migrations and
seeds the providers before the rest starts. They all share one image, built
from the root `Dockerfile`.

Postgres belongs to the stack. **Redis, RabbitMQ and S3 (Garage) are shared
with the other projects on the host** — the stack joins their networks and
addresses them by container name, so those networks must already exist, and
brief needs its own Garage key and bucket and its own RabbitMQ user and vhost.

```bash
cp .env.docker.example .env.docker   # fill in — hostnames are container names
make prod-up                         # build, migrate, start, wait for healthy
```

| Command | Description |
| --- | --- |
| `make prod-up` | Build, migrate and start the stack |
| `make prod-down` | Stop it (volumes are kept) |
| `make prod-logs` | Follow the logs |
| `make prod-ps` | Show the containers |
| `make prod-build` | Build the image alone |
| `make prod-migrate` | Re-run the migrations and the provider seed |

The web server listens on 3000 and is published on loopback only
(`WEB_HOST_PORT`): TLS and the public hostname belong to the reverse proxy in
front, which is what `SITE_URL` names. Register the Telegram webhook against it
once per environment with
`make telegram-webhook ENV_FILE=.env.docker TELEGRAM_WEBHOOK_URL=https://.../api/telegram/webhook`.

## Observability

The web app serves Prometheus metrics at `GET /metrics`, every series prefixed
`brief_web_`:

| Series | What it answers |
| --- | --- |
| `brief_web_process_*`, `brief_web_nodejs_*` | Is the process healthy — event loop lag, heap, GC, handles |
| `brief_web_http_request_duration_seconds` | Wire-level latency and error rate, by `route`, `method` and `status_class` |
| `brief_web_server_fn_requests_total` / `_duration_seconds` | Per-operation volume, outcome and latency of the server functions |
| `brief_web_category_jobs` / `_provider_fetch_jobs` / `_message_jobs` | Today's pipeline, by job status — a `failed` above zero is the alert |
| `brief_web_category_job_tokens` | What today's briefs cost in LLM tokens |

`brief_web_category_jobs{status="no_articles_selected"}` is **not** a failure:
the pipeline ran and the editor kept nothing that day. Alert on `failed` only,
and chart the two apart — a category that stays on `no_articles_selected` for
days is a sourcing problem, not an outage.

The pipeline gauges are counted in SQL at scrape time, scoped to the current
target date. A database that is down leaves them at their last value and logs a
warning rather than failing the scrape, so the process metrics still say whether
the app is up.

`route` is a **bounded** label set: add every new route to `KNOWN_ROUTES` in
[apps/web/src/libs/server/metrics.ts](apps/web/src/libs/server/metrics.ts) or it
silently collapses into `other`. Renaming the `brief_web_` prefix orphans the
Grafana dashboards — don't.

### Scraping it

There is no authentication on the endpoint. It is not meant to be reachable from
the outside: the `web` container joins the external `monitoring-shared` network,
and Prometheus scrapes it there, by container name.

```yaml
  - job_name: brief-web
    metrics_path: /metrics
    static_configs:
      - targets:
          - brief-web-prod:3000
```

Two things must hold, and both fail silently:

- **The reverse proxy must refuse `/metrics`.** It is published on loopback
  along with the rest of the app, so a proxy that forwards everything exposes it.
- **`WEB_ALLOWED_HOSTS` must contain `brief-web-prod`.** The scrape arrives with
  that container name as its `Host`, which is not `SITE_URL`'s, and `vite preview`
  answers a 403 that reads from Grafana like the app being down.

The workers and the scheduler expose nothing of their own — they have no HTTP
server. Their side of the pipeline is visible through the job gauges above, and
through RabbitMQ's own `/metrics` on the shared broker.

## Structure

```text
brief/
├── apps/
│   ├── web/                    # TanStack Start app → http://localhost:3000
│   ├── scheduler/              # enqueues the daily jobs
│   ├── providerFetch-worker/   # fetches and ingests articles
│   ├── category-worker/        # summarises and renders a brief
│   └── message-worker/         # outbound messages
├── db/
│   └── drizzle/                # schema & migrations
├── packages/
│   ├── common/                 # constants, shared types
│   ├── infra/                  # pino, redis, amqp, domain errors
│   └── services/               # business logic (classes taking a Database)
├── garage/                     # S3 bootstrap config
├── biome.json
├── Dockerfile                  # one image for every app
├── docker-compose.yaml         # dev dependencies
├── docker-compose.prod.yaml    # the deployed stack
└── pnpm-workspace.yaml
```

See [AGENT.md](AGENT.md) for the data model, the pipeline, and the current boundaries.
