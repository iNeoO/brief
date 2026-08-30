# One image for every app: they share the workspace packages, so building them
# separately would install and compile the same tree five times. The command
# in docker-compose.prod.yaml picks which one runs.

ARG NODE_VERSION=24-alpine
FROM node:${NODE_VERSION} AS base

ARG PNPM_VERSION=11.10.0

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Global rather than through corepack, which caches the package manager under
# the building user's home: the runtime stage runs as `node` and would find
# nothing there, re-downloading pnpm on every container start.
RUN npm install --global pnpm@${PNPM_VERSION}

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/category-worker/package.json apps/category-worker/package.json
COPY apps/message-worker/package.json apps/message-worker/package.json
COPY apps/providerFetch-worker/package.json apps/providerFetch-worker/package.json
COPY apps/scheduler/package.json apps/scheduler/package.json
COPY apps/web/package.json apps/web/package.json
COPY db/drizzle/package.json db/drizzle/package.json
COPY packages/common/package.json packages/common/package.json
COPY packages/infra/package.json packages/infra/package.json
COPY packages/services/package.json packages/services/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY apps apps
COPY db db
COPY packages packages

RUN pnpm build

FROM base AS runtime

ENV NODE_ENV=production

COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=deps /app/package.json ./package.json
COPY --chown=node:node --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --chown=node:node --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

COPY --chown=node:node --from=builder /app/apps apps
COPY --chown=node:node --from=builder /app/db db
COPY --chown=node:node --from=builder /app/packages packages

USER node

EXPOSE 3000

CMD ["pnpm", "--filter", "@brief/web", "preview"]
