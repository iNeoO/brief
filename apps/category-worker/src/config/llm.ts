import { LLM_PROVIDER } from "@brief/common/constants";
import { createTextAdapter } from "@brief/services";
import type { OpenAiConfig } from "@brief/services/llm";
import { env } from "./env.js";

const openAiAdapter = (model: OpenAiConfig["model"]) =>
	createTextAdapter({ provider: LLM_PROVIDER.OPENAI, openai: { model } });

const freeLlmAdapter = () => {
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

export const createConfiguredTextAdapters = () => {
	if (env.LLM_PROVIDER !== LLM_PROVIDER.OPENAI) {
		const adapter = freeLlmAdapter();
		return { selection: adapter, summary: adapter };
	}
	return {
		selection: openAiAdapter(env.OPENAI_SELECTION_MODEL ?? env.OPENAI_MODEL),
		summary: openAiAdapter(env.OPENAI_MODEL),
	};
};
