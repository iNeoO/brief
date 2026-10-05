import { DEFAULT_LLM_PROVIDER, LLM_PROVIDER } from "@brief/common/constants";
import { z } from "zod";

const envSchema = z.object({
	WORKER_ID: z.string().min(1),
	PG_URL: z.string().min(1),
	AMQP_URL: z.string().min(1),
	CATEGORY_QUEUE: z.string().min(1),
	// The worker consumes category jobs and produces message jobs: once a brief is
	// finished it publishes one delivery per subscriber.
	MESSAGE_JOB_QUEUE: z.string().min(1),
	LLM_PROVIDER: z.enum(LLM_PROVIDER).default(DEFAULT_LLM_PROVIDER),
	FREE_LLM_API_URL: z.url(),
	FREE_LLM_API_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);
