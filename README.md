# brief

## Stack

- **Backend**: Hono (OpenAPI · RPC client) — `http://localhost:4000`
- **Frontend**: React 19 (TanStack Router · TanStack Query · Tailwind v4) — `http://localhost:5173`
- **ORM**: Drizzle — PostgreSQL
- **Tooling**: pnpm workspaces · TypeScript · Biome

## Prerequisites

- [Node.js](https://nodejs.org) ≥ 20
- [pnpm](https://pnpm.io) ≥ 11
- [Docker](https://www.docker.com)

## First-time setup

```bash
cp .env.example .env   # configure DB credentials
docker compose up -d   # start PostgreSQL
pnpm drizzle:push      # apply schema to DB
pnpm dev               # build libs + start dev servers
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Build all libs and start dev servers |
| `pnpm hono:dev` | Start Hono in watch mode |
| `pnpm react:dev` | Start React dev server |
| `pnpm drizzle:push` | Push schema changes to the DB |
| `pnpm drizzle:generate` | Generate migration files |
| `pnpm drizzle:migrate` | Run pending migrations |

## Structure

```
brief/
├── apps/
│   ├── hono/          # Backend  → http://localhost:4000
│   └── react/         # Frontend → http://localhost:5173
├── db/
│   └── drizzle/       # Schema & migrations
├── packages/
│   ├── common/        # Shared types & schemas
│   ├── infra/         # Logger (Pino), OpenAPI helpers
│   └── services/      # Business logic (PostsService, UsersService…)
├── biome.json
├── docker-compose.yaml
└── pnpm-workspace.yaml
```
