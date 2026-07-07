ALTER TYPE "job_state" RENAME TO "category_job_state";--> statement-breakpoint
ALTER TABLE "job_articles" RENAME TO "category_job_articles";--> statement-breakpoint
ALTER TABLE "job_events" RENAME TO "category_job_events";--> statement-breakpoint
ALTER TABLE "jobs" RENAME TO "category_jobs";--> statement-breakpoint
ALTER TABLE "category_job_articles" RENAME COLUMN "job_id" TO "category_job_id";--> statement-breakpoint
ALTER TABLE "category_job_events" RENAME COLUMN "job_id" TO "category_job_id";--> statement-breakpoint
ALTER TABLE "files" RENAME COLUMN "job_id" TO "category_job_id";--> statement-breakpoint
ALTER TABLE "category_jobs" RENAME CONSTRAINT "jobs_finished_at_consistency" TO "category_jobs_finished_at_consistency";--> statement-breakpoint
ALTER TABLE "category_jobs" RENAME CONSTRAINT "jobs_failed_requires_error" TO "category_jobs_failed_requires_error";--> statement-breakpoint
ALTER INDEX "job_articles_article_id_idx" RENAME TO "category_job_articles_article_id_idx";--> statement-breakpoint
ALTER INDEX "job_events_job_id_created_at_idx" RENAME TO "category_job_events_category_job_id_created_at_idx";--> statement-breakpoint
ALTER INDEX "jobs_status_created_at_idx" RENAME TO "category_jobs_status_created_at_idx";--> statement-breakpoint
ALTER INDEX "jobs_pending_queue_idx" RENAME TO "category_jobs_pending_queue_idx";--> statement-breakpoint
ALTER TABLE "category_jobs" RENAME CONSTRAINT "jobs_category_target_date_unique" TO "category_jobs_category_target_date_unique";--> statement-breakpoint
ALTER TABLE "files" RENAME CONSTRAINT "files_job_kind_language_unique" TO "files_category_job_kind_language_unique";