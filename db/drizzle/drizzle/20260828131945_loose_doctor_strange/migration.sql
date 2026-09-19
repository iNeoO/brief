CREATE TABLE "message_announcements" (
	"user_id" text,
	"target_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_announcements_pkey" PRIMARY KEY("user_id","target_date")
);
--> statement-breakpoint
ALTER TABLE "message_jobs" DROP CONSTRAINT "message_jobs_category_job_id_key";--> statement-breakpoint
ALTER TABLE "message_jobs" ADD COLUMN "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "message_jobs" ADD COLUMN "retry" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "message_jobs" ADD COLUMN "is_first" boolean;--> statement-breakpoint
ALTER TABLE "telegram_pairings" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "message_jobs" ADD CONSTRAINT "message_jobs_category_job_user_unique" UNIQUE("category_job_id","user_id");--> statement-breakpoint
CREATE INDEX "message_jobs_user_id_idx" ON "message_jobs" ("user_id");--> statement-breakpoint
ALTER TABLE "message_announcements" ADD CONSTRAINT "message_announcements_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "message_jobs" ADD CONSTRAINT "message_jobs_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;