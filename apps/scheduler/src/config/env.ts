import { z } from "zod";

const envSchema = z.object({
	PG_URL: z.string().min(1),
	AMQP_URL: z.string().min(1),
	PROVIDER_FETCH_QUEUE: z.string().min(1),
});

export const env = envSchema.parse(process.env);
