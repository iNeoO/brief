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
});

export const env = envSchema.parse(process.env);
