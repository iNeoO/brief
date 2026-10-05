import { createTextAdapter } from "@brief/services";
import { env } from "./env.js";

export const createConfiguredTextAdapter = () =>
	createTextAdapter({
		provider: env.LLM_PROVIDER,
		freeLlm: { baseUrl: env.FREE_LLM_API_URL, apiKey: env.FREE_LLM_API_KEY },
	});
