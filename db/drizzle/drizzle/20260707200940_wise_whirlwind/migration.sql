ALTER TABLE "category_job_events" ADD COLUMN "state" "category_job_state" NOT NULL;--> statement-breakpoint
ALTER TABLE "category_job_events" DROP COLUMN "from_state";--> statement-breakpoint
ALTER TABLE "category_job_events" DROP COLUMN "to_state";