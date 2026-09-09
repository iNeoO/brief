import { ADMIN_USER_IDS_SEPARATOR } from "@brief/common/constants";
import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	BETTER_AUTH_URL: z.url(),
	// The public origin the site is served from. Canonical URLs, the sitemap and
	// the social-card metadata are absolute by specification, so this cannot be
	// read off the incoming request: behind a proxy a crawler would be handed the
	// internal host as the address to index. The trailing slash goes here rather
	// than at every call site.
	SITE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
	BETTER_AUTH_SECRET: z.string().min(32),
	PG_URL: z.string().min(1),
	REDIS_URL: z.string().min(1),
	BETTER_AUTH_REDIS_KEY_PREFIX: z.string().default("brief:auth:"),
	RESEND_API_KEY: z.string().min(1),
	RESEND_FROM_EMAIL: z.string().min(1),
	// Needed to purge the audio objects of a deleted category. Required, like
	// every other block here: the app refuses to boot half-configured rather
	// than discovering the gap on the first delete.
	S3_ENDPOINT: z.string().min(1),
	S3_PORT: z.coerce.number().int().positive(),
	S3_REGION: z.string().min(1),
	S3_USE_SSL: z.stringbool().default(false),
	S3_ACCESS_KEY: z.string().min(1),
	S3_SECRET_KEY: z.string().min(1),
	S3_BUCKET: z.string().min(1),
	// Telegram pairing. Deliberately here and not in `packages/infra`, whose env
	// module parses at import time for every worker: a variable added there is a
	// variable each of the four workers has to set before it will boot.
	//
	// From @BotFather. The only credential Telegram needs, and enough to write to
	// every chat that has started the bot — so it is never logged.
	TELEGRAM_BOT_TOKEN: z.string().min(1),
	// Without the leading `@`. Telegram's own rule for a bot username: 5 to 32
	// characters, letters, digits and underscores. This is what the `t.me` deep
	// link addresses, so a wrong value produces a link to nowhere.
	TELEGRAM_BOT_USERNAME: z.string().regex(/^[A-Za-z0-9_]{5,32}$/),
	// Sent back by Telegram as X-Telegram-Bot-Api-Secret-Token on every webhook
	// call. Without it the endpoint would take instructions from anyone who found
	// the URL.
	TELEGRAM_WEBHOOK_SECRET: z.string().min(16),
	ADMIN_USER_IDS: z
		.string()
		.default("")
		.transform((ids) =>
			ids
				.split(ADMIN_USER_IDS_SEPARATOR)
				.map((id) => id.trim())
				.filter(Boolean),
		),
});

export const env = envSchema.parse(process.env);
