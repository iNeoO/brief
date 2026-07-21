import { z } from "zod";

const envSchema = z.object({
	AMQP_URL: z.string(),
	PROVIDER_FETCH_QUEUE: z.string(),
});

export const env = envSchema.parse(process.env);
