import { z } from "zod";

const envSchema = z.object({
	WORKER_ID: z.string().min(1),
	AMQP_URL: z.string().min(1),
	MESSAGE_JOB_QUEUE: z.string().min(1),
});

export const env = envSchema.parse(process.env);
