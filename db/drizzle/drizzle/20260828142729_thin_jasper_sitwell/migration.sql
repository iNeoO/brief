ALTER TABLE "category_jobs" ADD COLUMN "prompt_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "category_jobs" ADD COLUMN "completion_tokens" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "category_jobs" ADD COLUMN "total_tokens" integer DEFAULT 0 NOT NULL;