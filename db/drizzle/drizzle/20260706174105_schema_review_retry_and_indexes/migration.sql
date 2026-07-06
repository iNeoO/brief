DROP TABLE "job_reports";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "is_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "summary" text;--> statement-breakpoint
CREATE INDEX "articles_provider_id_published_at_idx" ON "articles" ("provider_id","published_at");--> statement-breakpoint
CREATE INDEX "jobs_pending_queue_idx" ON "jobs" ("created_at") WHERE "status" = 'pending';--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_finished_at_consistency" CHECK (("status" IN ('finished', 'failed')) = ("finished_at" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_failed_requires_error" CHECK ("status" <> 'failed' OR "error" IS NOT NULL);