CREATE TYPE "category_job_status" AS ENUM('waiting_for_providers', 'pending', 'running', 'finished', 'failed');--> statement-breakpoint
CREATE TABLE "category_job_provider_fetch_jobs" (
	"category_job_id" integer,
	"provider_fetch_job_id" integer,
	CONSTRAINT "category_job_provider_fetch_jobs_pkey" PRIMARY KEY("category_job_id","provider_fetch_job_id")
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
ALTER TABLE "categories" DROP CONSTRAINT "categories_slug_key";--> statement-breakpoint
ALTER TABLE "category_providers" DROP CONSTRAINT "category_providers_weight_positive";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "is_enabled";--> statement-breakpoint
ALTER TABLE "category_providers" DROP COLUMN "weight";--> statement-breakpoint
ALTER TABLE "category_providers" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "category_providers" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "articles" ALTER COLUMN "provider_id" SET DATA TYPE uuid USING "provider_id"::uuid;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE "categories_id_seq";--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "category_job_articles" ALTER COLUMN "rank" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "category_jobs" ALTER COLUMN "category_id" SET DATA TYPE uuid USING "category_id"::uuid;--> statement-breakpoint
ALTER TABLE "category_jobs" ALTER COLUMN "status" SET DATA TYPE "category_job_status" USING "status"::text::"category_job_status";--> statement-breakpoint
ALTER TABLE "category_jobs" ALTER COLUMN "state" SET DEFAULT 'creating_report'::"category_job_state";--> statement-breakpoint
ALTER TABLE "category_providers" ALTER COLUMN "category_id" SET DATA TYPE uuid USING "category_id"::uuid;--> statement-breakpoint
ALTER TABLE "category_providers" ALTER COLUMN "provider_id" SET DATA TYPE uuid USING "provider_id"::uuid;--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "provider_fetch_jobs" ALTER COLUMN "provider_id" SET DATA TYPE uuid USING "provider_id"::uuid;--> statement-breakpoint
ALTER TABLE "providers" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DROP SEQUENCE "providers_id_seq";--> statement-breakpoint
ALTER TABLE "providers" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "providers" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "category_job_articles" ADD CONSTRAINT "category_job_articles_job_rank_unique" UNIQUE("category_job_id","rank");--> statement-breakpoint
CREATE INDEX "category_job_provider_fetch_jobs_provider_job_idx" ON "category_job_provider_fetch_jobs" ("provider_fetch_job_id");--> statement-breakpoint
CREATE INDEX "provider_fetch_job_articles_article_id_idx" ON "provider_fetch_job_articles" ("article_id");--> statement-breakpoint
CREATE INDEX "provider_fetch_job_events_id_created_at_idx" ON "provider_fetch_job_events" ("provider_fetch_job_id","created_at");--> statement-breakpoint
ALTER TABLE "category_job_provider_fetch_jobs" ADD CONSTRAINT "category_job_provider_fetch_jobs_qJX09k8ntEST_fkey" FOREIGN KEY ("category_job_id") REFERENCES "category_jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "category_job_provider_fetch_jobs" ADD CONSTRAINT "category_job_provider_fetch_jobs_4bZiFPbDAEC3_fkey" FOREIGN KEY ("provider_fetch_job_id") REFERENCES "provider_fetch_jobs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "provider_fetch_job_articles" ADD CONSTRAINT "provider_fetch_job_articles_yPO07Pi8cMV9_fkey" FOREIGN KEY ("provider_fetch_job_id") REFERENCES "provider_fetch_jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "provider_fetch_job_articles" ADD CONSTRAINT "provider_fetch_job_articles_article_id_articles_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "provider_fetch_job_events" ADD CONSTRAINT "provider_fetch_job_events_pKB3vButXCVr_fkey" FOREIGN KEY ("provider_fetch_job_id") REFERENCES "provider_fetch_jobs"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "category_job_articles" ADD CONSTRAINT "category_job_articles_rank_non_negative" CHECK ("rank" >= 0);