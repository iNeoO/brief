CREATE TYPE "category_job_state" AS ENUM('creating_report', 'creating_audio', 'sending_message');--> statement-breakpoint
CREATE TYPE "category_job_status" AS ENUM('waiting_for_providers', 'pending', 'running', 'finished', 'failed');--> statement-breakpoint
CREATE TYPE "connector_kind" AS ENUM('rss');--> statement-breakpoint
CREATE TYPE "file_kind" AS ENUM('audio_file');--> statement-breakpoint
CREATE TYPE "job_status" AS ENUM('pending', 'running', 'finished', 'failed');--> statement-breakpoint
CREATE TYPE "language" AS ENUM('fr', 'en');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"provider_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_provider_url_unique" UNIQUE("provider_id","url")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" text NOT NULL,
	"description" text NOT NULL,
	"language" "language" DEFAULT 'fr'::"language" NOT NULL,
	"is_enable" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_job_articles" (
	"category_job_id" integer,
	"article_id" uuid,
	"rank" integer NOT NULL,
	CONSTRAINT "category_job_articles_pkey" PRIMARY KEY("category_job_id","article_id"),
	CONSTRAINT "category_job_articles_job_rank_unique" UNIQUE("category_job_id","rank"),
	CONSTRAINT "category_job_articles_rank_non_negative" CHECK ("rank" >= 0)
);
--> statement-breakpoint
CREATE TABLE "category_job_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"category_job_id" integer NOT NULL,
	"attempt" integer NOT NULL,
	"state" "category_job_state" NOT NULL,
	"status" "job_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_job_provider_fetch_jobs" (
	"category_job_id" integer,
	"provider_fetch_job_id" integer,
	CONSTRAINT "category_job_provider_fetch_jobs_pkey" PRIMARY KEY("category_job_id","provider_fetch_job_id")
);
--> statement-breakpoint
CREATE TABLE "category_jobs" (
	"id" serial PRIMARY KEY,
	"category_id" uuid NOT NULL,
	"target_date" date NOT NULL,
	"status" "category_job_status" NOT NULL,
	"state" "category_job_state" DEFAULT 'creating_report'::"category_job_state" NOT NULL,
	"summary" text,
	"sources" text,
	"error" text,
	"retry" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "category_jobs_category_target_date_unique" UNIQUE("category_id","target_date"),
	CONSTRAINT "category_jobs_finished_at_consistency" CHECK (("status" IN ('finished', 'failed')) = ("finished_at" IS NOT NULL)),
	CONSTRAINT "category_jobs_failed_requires_error" CHECK ("status" <> 'failed' OR "error" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "category_providers" (
	"category_id" uuid,
	"provider_id" uuid,
	CONSTRAINT "category_providers_pkey" PRIMARY KEY("category_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"category_job_id" integer NOT NULL,
	"kind" "file_kind" NOT NULL,
	"language" "language" NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"filename" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_category_job_kind_language_unique" UNIQUE("category_job_id","kind","language")
);
--> statement-breakpoint
CREATE TABLE "message_jobs" (
	"id" serial PRIMARY KEY,
	"category_job_id" integer NOT NULL UNIQUE,
	"status" "job_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "provider_fetch_job_articles" (
	"provider_fetch_job_id" integer,
	"article_id" uuid,
	CONSTRAINT "provider_fetch_job_articles_pkey" PRIMARY KEY("provider_fetch_job_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "provider_fetch_job_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"provider_fetch_job_id" integer NOT NULL,
	"attempt" integer NOT NULL,
	"status" "job_status" NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_fetch_jobs" (
	"id" serial PRIMARY KEY,
	"provider_id" uuid NOT NULL,
	"target_date" date NOT NULL,
	"status" "job_status" NOT NULL,
	"error" text,
	"retry" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "provider_fetch_jobs_provider_target_date_unique" UNIQUE("provider_id","target_date"),
	CONSTRAINT "provider_fetch_jobs_finished_at_consistency" CHECK (("status" IN ('finished', 'failed')) = ("finished_at" IS NOT NULL)),
	CONSTRAINT "provider_fetch_jobs_failed_requires_error" CHECK ("status" <> 'failed' OR "error" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"url" text NOT NULL,
	"kind" "connector_kind" DEFAULT 'rss'::"connector_kind" NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"fetch_limit" integer DEFAULT 5,
	"last_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "providers_fetch_limit_positive" CHECK ("fetch_limit" > 0)
);
--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" ("published_at");--> statement-breakpoint
CREATE INDEX "articles_provider_id_published_at_idx" ON "articles" ("provider_id","published_at");--> statement-breakpoint
CREATE INDEX "category_job_articles_article_id_idx" ON "category_job_articles" ("article_id");--> statement-breakpoint
CREATE INDEX "category_job_events_category_job_id_created_at_idx" ON "category_job_events" ("category_job_id","created_at");--> statement-breakpoint
CREATE INDEX "category_job_provider_fetch_jobs_provider_job_idx" ON "category_job_provider_fetch_jobs" ("provider_fetch_job_id");--> statement-breakpoint
CREATE INDEX "category_jobs_status_created_at_idx" ON "category_jobs" ("status","created_at");--> statement-breakpoint
CREATE INDEX "category_jobs_pending_queue_idx" ON "category_jobs" ("created_at") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "category_providers_provider_id_idx" ON "category_providers" ("provider_id");--> statement-breakpoint
CREATE INDEX "message_jobs_status_created_at_idx" ON "message_jobs" ("status","created_at");--> statement-breakpoint
CREATE INDEX "provider_fetch_job_articles_article_id_idx" ON "provider_fetch_job_articles" ("article_id");--> statement-breakpoint
CREATE INDEX "provider_fetch_job_events_id_created_at_idx" ON "provider_fetch_job_events" ("provider_fetch_job_id","created_at");--> statement-breakpoint
CREATE INDEX "provider_fetch_jobs_status_created_at_idx" ON "provider_fetch_jobs" ("status","created_at");--> statement-breakpoint
CREATE INDEX "provider_fetch_jobs_pending_queue_idx" ON "provider_fetch_jobs" ("created_at") WHERE "status" = 'pending';--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "category_job_articles" ADD CONSTRAINT "category_job_articles_category_job_id_category_jobs_id_fkey" FOREIGN KEY ("category_job_id") REFERENCES "category_jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "category_job_articles" ADD CONSTRAINT "category_job_articles_article_id_articles_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "category_job_events" ADD CONSTRAINT "category_job_events_category_job_id_category_jobs_id_fkey" FOREIGN KEY ("category_job_id") REFERENCES "category_jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "category_job_provider_fetch_jobs" ADD CONSTRAINT "category_job_provider_fetch_jobs_qJX09k8ntEST_fkey" FOREIGN KEY ("category_job_id") REFERENCES "category_jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "category_job_provider_fetch_jobs" ADD CONSTRAINT "category_job_provider_fetch_jobs_4bZiFPbDAEC3_fkey" FOREIGN KEY ("provider_fetch_job_id") REFERENCES "provider_fetch_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "category_jobs" ADD CONSTRAINT "category_jobs_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "category_providers" ADD CONSTRAINT "category_providers_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "category_providers" ADD CONSTRAINT "category_providers_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_category_job_id_category_jobs_id_fkey" FOREIGN KEY ("category_job_id") REFERENCES "category_jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "message_jobs" ADD CONSTRAINT "message_jobs_category_job_id_category_jobs_id_fkey" FOREIGN KEY ("category_job_id") REFERENCES "category_jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "provider_fetch_job_articles" ADD CONSTRAINT "provider_fetch_job_articles_yPO07Pi8cMV9_fkey" FOREIGN KEY ("provider_fetch_job_id") REFERENCES "provider_fetch_jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "provider_fetch_job_articles" ADD CONSTRAINT "provider_fetch_job_articles_article_id_articles_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "provider_fetch_job_events" ADD CONSTRAINT "provider_fetch_job_events_pKB3vButXCVr_fkey" FOREIGN KEY ("provider_fetch_job_id") REFERENCES "provider_fetch_jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "provider_fetch_jobs" ADD CONSTRAINT "provider_fetch_jobs_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT;