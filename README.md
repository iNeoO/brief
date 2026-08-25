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
├── docker-compose.yaml
└── pnpm-workspace.yaml
```

See [AGENT.md](AGENT.md) for the data model, the pipeline, and the current boundaries.
