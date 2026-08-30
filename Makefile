# Thin wrapper over docker compose + the pnpm scripts. See README.md for the
# full command list; this file covers the everyday entry points, plus the one-off
# calls nobody remembers (the Telegram webhook).

.DEFAULT_GOAL := help
.PHONY: help dev dev-all test check up down logs setup \
	prod-build prod-up prod-down prod-logs prod-migrate prod-ps \
	telegram-webhook telegram-webhook-info telegram-webhook-delete

help: ## List the available targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'

up: ## Start Postgres, Redis, RabbitMQ and Garage, and wait for them
	docker compose up -d --wait

down: ## Stop the containers (volumes are kept)
	docker compose down

logs: ## Follow the container logs
	docker compose logs -f

dev: up ## Start the stack and the app
	pnpm dev

dev-all: up ## Same, plus the workers and the scheduler
	pnpm dev:all

test: up ## Start the stack and run every package's tests
	pnpm test

check: up ## The full gate: lint, build, typecheck, test
	pnpm check

setup: up ## First-time setup: S3 bucket, schema, seed data
	pnpm garage:init
	pnpm drizzle:push
	pnpm drizzle:seed

# --- Production ------------------------------------------------------------
# `--env-file` makes .env.docker both what compose interpolates and what the
# containers receive; without it compose silently interpolates the dev .env.

PROD = docker compose --env-file .env.docker -f docker-compose.prod.yaml

prod-build: ## Build the production image
	$(PROD) build

prod-up: ## Build, migrate and start the production stack
	$(PROD) up -d --build --wait

prod-down: ## Stop the production stack (volumes are kept)
	$(PROD) down

prod-logs: ## Follow the production logs
	$(PROD) logs -f

prod-ps: ## Show the production containers
	$(PROD) ps

prod-migrate: ## Re-run the migrations and the provider seed on their own
	$(PROD) run --rm db-migrate

# --- Telegram webhook ------------------------------------------------------
# One-off per environment, and nobody remembers the curl. The token and the
# secret come from $(ENV_FILE) — .env in dev, `ENV_FILE=.env.docker` in prod,
# since a bot has exactly one webhook and each environment claims it with its
# own token. TELEGRAM_WEBHOOK_URL is the public HTTPS URL of
# /api/telegram/webhook — Telegram accepts only ports 443, 80, 88 and 8443 and
# requires a valid certificate, so in dev this is the tunnel. See
# docs/telegram-pairing-testing.md.

ENV_FILE ?= .env
TG_TOKEN = $(shell sed -n 's/^TELEGRAM_BOT_TOKEN=//p' $(ENV_FILE) 2>/dev/null)
TG_SECRET = $(shell sed -n 's/^TELEGRAM_WEBHOOK_SECRET=//p' $(ENV_FILE) 2>/dev/null)
TG_API = https://api.telegram.org/bot$(TG_TOKEN)
TG_REQUIRE_TOKEN = test -n "$(TG_TOKEN)" || { echo "TELEGRAM_BOT_TOKEN is missing from $(ENV_FILE)"; exit 1; }

telegram-webhook: ## Register the webhook (needs TELEGRAM_WEBHOOK_URL=https://...)
	@$(TG_REQUIRE_TOKEN)
	@test -n "$(TG_SECRET)" || { echo "TELEGRAM_WEBHOOK_SECRET is missing from $(ENV_FILE)"; exit 1; }
	@test -n "$(TELEGRAM_WEBHOOK_URL)" || { echo "TELEGRAM_WEBHOOK_URL is required"; exit 1; }
	@curl -fsS -X POST "$(TG_API)/setWebhook" \
		-H 'content-type: application/json' \
		-d "$$(printf '{"url":"%s","secret_token":"%s","allowed_updates":["message","my_chat_member"]}' \
			"$(TELEGRAM_WEBHOOK_URL)" "$(TG_SECRET)")"
	@echo

telegram-webhook-info: ## Show what Telegram thinks the webhook is, and its last error
	@$(TG_REQUIRE_TOKEN)
	@curl -fsS "$(TG_API)/getWebhookInfo"
	@echo

telegram-webhook-delete: ## Unregister the webhook (a bot has only one)
	@$(TG_REQUIRE_TOKEN)
	@curl -fsS "$(TG_API)/deleteWebhook"
	@echo
