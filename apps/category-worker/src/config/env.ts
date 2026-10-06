import { DEFAULT_LLM_PROVIDER, LLM_PROVIDER } from "@brief/common/constants";
import { DEFAULT_OPENAI_MODEL, OPENAI_TEXT_MODELS } from "@brief/services/llm";
import { z } from "zod";

const envSchema = z
	.object({
		WORKER_ID: z.string().min(1),
		PG_URL: z.string().min(1),
		AMQP_URL: z.string().min(1),
		CATEGORY_QUEUE: z.string().min(1),
		// The worker consumes category jobs and produces message jobs: once a brief is
		// finished it publishes one delivery per subscriber.
		MESSAGE_JOB_QUEUE: z.string().min(1),
		LLM_PROVIDER: z.enum(LLM_PROVIDER).default(DEFAULT_LLM_PROVIDER),
		OPENAI_MODEL: z.enum(OPENAI_TEXT_MODELS).default(DEFAULT_OPENAI_MODEL),
		OPENAI_SELECTION_MODEL: z.preprocess(
			(value) => (value === "" ? undefined : value),
			z.enum(OPENAI_TEXT_MODELS).optional(),
		),
		FREE_LLM_API_URL: z.url(),
		FREE_LLM_API_KEY: z.string().min(1),
		// The example env files ship the variable empty.
		FREE_LLM_MODEL: z.preprocess(
			(value) => (value === "" ? undefined : value),
			z.string().min(1).optional(),
		),
	})
	.superRefine((env, ctx) => {
		if (env.LLM_PROVIDER !== LLM_PROVIDER.FREELLMAPI) return;
		// `auto` may route to a model that ignores tools; only bench-validated models are allowed.
		if (!env.FREE_LLM_MODEL || env.FREE_LLM_MODEL.startsWith("auto")) {
			ctx.addIssue({
				code: "custom",
				path: ["FREE_LLM_MODEL"],
				message:
					"FreeLLMAPI needs an explicit model validated by `pnpm llm:benchmark`, not `auto`",
			});
		}
	});

export const env = envSchema.parse(process.env);
