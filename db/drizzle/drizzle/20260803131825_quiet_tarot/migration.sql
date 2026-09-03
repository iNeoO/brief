ALTER TYPE "file_language" RENAME TO "language";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "language" "language" DEFAULT 'fr'::"language" NOT NULL;