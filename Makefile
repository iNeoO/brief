# Thin wrapper over docker compose + the pnpm scripts. See README.md for the
# full command list; this file only covers the two everyday entry points.

.DEFAULT_GOAL := help
.PHONY: help dev dev-all test check up down logs setup

help: ## List the available targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

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
