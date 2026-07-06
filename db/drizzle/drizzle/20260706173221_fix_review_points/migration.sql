CREATE TYPE "file_kind" AS ENUM('audio_file');--> statement-breakpoint
CREATE TYPE "file_language" AS ENUM('fr', 'en');--> statement-breakpoint
CREATE TYPE "job_state" AS ENUM('getting_articles', 'creating_report', 'creating_audio', 'sending_message');--> statement-breakpoint
CREATE TYPE "job_status" AS ENUM('pending', 'running', 'finished', 'failed');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_providers" (
	"category_id" integer,
	"provider_id" integer,
	"weight" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_providers_pkey" PRIMARY KEY("category_id","provider_id"),
	CONSTRAINT "category_providers_weight_positive" CHECK ("weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"job_id" integer NOT NULL,
	"kind" "file_kind" NOT NULL,
	"language" "file_language" NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"filename" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_job_kind_language_unique" UNIQUE("job_id","kind","language")
);
--> statement-breakpoint
CREATE TABLE "job_articles" (
	"job_id" integer,
	"article_id" uuid,
	"rank" integer,
	CONSTRAINT "job_articles_pkey" PRIMARY KEY("job_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "job_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"job_id" integer NOT NULL,
	"attempt" integer NOT NULL,
	"from_state" "job_state",
	"to_state" "job_state" NOT NULL,
	"status" "job_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_reports" (
	"job_id" integer PRIMARY KEY,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY,
	"category_id" integer NOT NULL,
	"target_date" date NOT NULL,
	"status" "job_status" NOT NULL,
	"state" "job_state" NOT NULL,
	"error" text,
	"retry" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_category_target_date_unique" UNIQUE("category_id","target_date")
);
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "providers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE "articles_id_seq";--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "published_at" SET DATA TYPE timestamp with time zone USING "published_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "providers" ALTER COLUMN "last_fetched_at" SET DATA TYPE timestamp with time zone USING "last_fetched_at"::timestamp with time zone;--> statement-breakpoint
ALTER TABLE "providers" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone USING "created_at"::timestamp with time zone;--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" ("published_at");--> statement-breakpoint
CREATE INDEX "category_providers_provider_id_idx" ON "category_providers" ("provider_id");--> statement-breakpoint
CREATE INDEX "job_articles_article_id_idx" ON "job_articles" ("article_id");--> statement-breakpoint
CREATE INDEX "job_events_job_id_created_at_idx" ON "job_events" ("job_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_created_at_idx" ON "jobs" ("status","created_at");--> statement-breakpoint
ALTER TABLE "category_providers" ADD CONSTRAINT "category_providers_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "category_providers" ADD CONSTRAINT "category_providers_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "job_articles" ADD CONSTRAINT "job_articles_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "job_articles" ADD CONSTRAINT "job_articles_article_id_articles_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "job_reports" ADD CONSTRAINT "job_reports_job_id_jobs_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "articles" DROP CONSTRAINT "articles_provider_id_providers_id_fkey", ADD CONSTRAINT "articles_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "providers" ADD CONSTRAINT "providers_fetch_limit_positive" CHECK ("fetch_limit" > 0);