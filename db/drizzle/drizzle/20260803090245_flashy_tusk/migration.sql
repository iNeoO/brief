CREATE TYPE "connector_kind" AS ENUM('rss');--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "kind" "connector_kind" DEFAULT 'rss'::"connector_kind" NOT NULL;