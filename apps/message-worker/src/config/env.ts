import { z } from "zod";

const envSchema = z.object({
	WORKER_ID: z.string().min(1),
	PG_URL: z.string().min(1),
	AMQP_URL: z.string().min(1),
	MESSAGE_JOB_QUEUE: z.string().min(1),
	TELEGRAM_BOT_TOKEN: z.string().min(1),
	TELEGRAM_BOT_USERNAME: z.string().min(1),
	// Telegram fetches a brief's audio from this origin, so it has to be the
	// public one — a localhost URL is unreachable from their servers.
	SITE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
});

export const env = envSchema.parse(process.env);
