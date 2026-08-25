CREATE TYPE "whatsapp_pairing_status" AS ENUM('verified', 'opted_out');--> statement-breakpoint
CREATE TABLE "whatsapp_pairings" (
	"user_id" text PRIMARY KEY,
	"phone_number" text NOT NULL CONSTRAINT "whatsapp_pairings_phone_number_unique" UNIQUE,
	"status" "whatsapp_pairing_status" NOT NULL,
	"opt_in_at" timestamp with time zone NOT NULL,
	"opt_in_message_id" text NOT NULL,
	"opt_in_text" text NOT NULL,
	"opted_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_pairings_opted_out_at_matches_status" CHECK (("status" = 'opted_out') = ("opted_out_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "whatsapp_pairings" ADD CONSTRAINT "whatsapp_pairings_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;