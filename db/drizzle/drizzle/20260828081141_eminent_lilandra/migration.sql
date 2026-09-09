CREATE TYPE "telegram_pairing_status" AS ENUM('verified', 'opted_out');--> statement-breakpoint
CREATE TABLE "telegram_pairings" (
	"user_id" text PRIMARY KEY,
	"chat_id" text NOT NULL CONSTRAINT "telegram_pairings_chat_id_unique" UNIQUE,
	"status" "telegram_pairing_status" NOT NULL,
	"opt_in_at" timestamp with time zone NOT NULL,
	"opt_in_update_id" text NOT NULL,
	"opt_in_text" text NOT NULL,
	"opted_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_pairings_opted_out_at_matches_status" CHECK (("status" = 'opted_out') = ("opted_out_at" IS NOT NULL))
);
--> statement-breakpoint
DROP TABLE "whatsapp_pairings";--> statement-breakpoint
ALTER TABLE "telegram_pairings" ADD CONSTRAINT "telegram_pairings_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
DROP TYPE "whatsapp_pairing_status";