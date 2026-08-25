ALTER TABLE "categories" RENAME COLUMN "is_enable" TO "is_enabled";--> statement-breakpoint
UPDATE "categories" SET "is_enabled" = true WHERE "is_enabled" IS NULL;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "is_enabled" SET NOT NULL;