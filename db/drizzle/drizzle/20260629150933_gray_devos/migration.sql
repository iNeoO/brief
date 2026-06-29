CREATE TABLE "articles" (
	"id" serial PRIMARY KEY,
	"provider_id" integer NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "articles_provider_url_unique" UNIQUE("provider_id","url")
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"url" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"fetch_limit" integer DEFAULT 5,
	"last_fetched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id");