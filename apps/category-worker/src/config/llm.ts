import { LLM_PROVIDER } from "@brief/common/constants";
import { createTextAdapter } from "@brief/services";
import { env } from "./env.js";

export const createConfiguredTextAdapter = () => {
	if (env.LLM_PROVIDER === LLM_PROVIDER.OPENAI) {
		return createTextAdapter({
			provider: LLM_PROVIDER.OPENAI,
			openai: { model: env.OPENAI_MODEL },
		});
	}
	if (!env.FREE_LLM_MODEL) {
		throw new Error("FREE_LLM_MODEL is required with FreeLLMAPI");
	}
	return createTextAdapter({
		provider: LLM_PROVIDER.FREELLMAPI,
		freeLlm: {
			baseUrl: env.FREE_LLM_API_URL,
			apiKey: env.FREE_LLM_API_KEY,
			model: env.FREE_LLM_MODEL,
		},
	});
};
