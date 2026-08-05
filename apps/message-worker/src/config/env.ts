import { z } from "zod";

const envSchema = z.object({
	WORKER_ID: z.string(),
	AMQP_URL: z.string(),
	MESSAGE_JOB_QUEUE: z.string(),
});

export const env = envSchema.parse(process.env);
