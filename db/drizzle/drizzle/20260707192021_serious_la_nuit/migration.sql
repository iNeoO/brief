CREATE TABLE "provider_fetch_jobs" (
	"id" serial PRIMARY KEY,
	"provider_id" integer NOT NULL,
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
ALTER TABLE "job_events" ALTER COLUMN "from_state" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "job_events" ALTER COLUMN "to_state" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "state" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "job_state";--> statement-breakpoint
CREATE TYPE "job_state" AS ENUM('creating_report', 'creating_audio', 'sending_message');--> statement-breakpoint
ALTER TABLE "job_events" ALTER COLUMN "from_state" SET DATA TYPE "job_state" USING "from_state"::"job_state";--> statement-breakpoint
ALTER TABLE "job_events" ALTER COLUMN "to_state" SET DATA TYPE "job_state" USING "to_state"::"job_state";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "state" SET DATA TYPE "job_state" USING "state"::"job_state";--> statement-breakpoint
CREATE INDEX "provider_fetch_jobs_status_created_at_idx" ON "provider_fetch_jobs" ("status","created_at");--> statement-breakpoint
CREATE INDEX "provider_fetch_jobs_pending_queue_idx" ON "provider_fetch_jobs" ("created_at") WHERE "status" = 'pending';--> statement-breakpoint
ALTER TABLE "provider_fetch_jobs" ADD CONSTRAINT "provider_fetch_jobs_provider_id_providers_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT;