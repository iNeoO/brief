import { z } from "zod";

const envSchema = z.object({
	WORKER_ID: z.string().min(1),
	PG_URL: z.string().min(1),
	AMQP_URL: z.string().min(1),
	MESSAGE_JOB_QUEUE: z.string().min(1),
	TELEGRAM_BOT_TOKEN: z.string().min(1),
	TELEGRAM_BOT_USERNAME: z.string().min(1),
	// Telegram fetches a brief's audio from this origin, so it has to be the
	// public one — a localhost URL is unreachable from their servers. No trailing
	// slash: `buildAudioUrl` appends a rooted path, and the `//` that would come
	// out of it is an address Telegram has to fetch.
	SITE_URL: z
		.url()
		.refine((url) => !url.endsWith("/"), "SITE_URL must not end with a slash"),
});

export const env = envSchema.parse(process.env);
