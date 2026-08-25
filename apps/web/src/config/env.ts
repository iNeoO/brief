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
	// WhatsApp pairing. Deliberately here and not in `packages/infra`, whose env
	// module parses at import time for every worker: a variable added there is a
	// variable each of the four workers has to set before it will boot.
	//
	// The number the user writes *to*, in E.164 digits with no `+` — that is the
	// form `wa.me` takes, and the form Cloud API reports numbers in.
	WHATSAPP_SENDER_NUMBER: z.string().regex(/^\d{8,15}$/),
	WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
	WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(1),
	WHATSAPP_ACCESS_TOKEN: z.string().min(1),
	// Signs the webhook body as X-Hub-Signature-256. Without it the endpoint would
	// take instructions from anyone who found the URL.
	WHATSAPP_APP_SECRET: z.string().min(1),
	// Echoed back to Meta once, when the callback URL is registered.
	WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(16),
	WHATSAPP_API_VERSION: z.string().default("v23.0"),
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
