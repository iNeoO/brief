import { ADMIN_USER_IDS_SEPARATOR } from "@brief/common/constants";
import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	BETTER_AUTH_URL: z.url(),
	BETTER_AUTH_SECRET: z.string().min(32),
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
