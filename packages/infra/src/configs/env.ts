import { z } from "zod";

const envSchema = z.object({
	PG_DB: z.string(),
	PG_USER: z.string(),
	PG_PASSWORD: z.string(),
	PG_URL: z.string(),
	FRONTEND_URL: z.url(),
});

export const env = envSchema.parse(process.env);
