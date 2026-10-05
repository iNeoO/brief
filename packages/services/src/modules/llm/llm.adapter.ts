import { LLM_PROVIDER } from "@brief/common/constants";
import type { LlmProvider } from "@brief/common/types";
import type { AnyTextAdapter } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import { OpenAIBaseChatCompletionsTextAdapter } from "@tanstack/openai-base";
// TanStack's adapters are typed against openai v6; the app's own SDK is v7.
import OpenAI from "openai-tanstack";

type FreeLlmConfig = { baseUrl: string; apiKey: string };

export type TextAdapterConfig = {
	provider: LlmProvider;
	freeLlm: FreeLlmConfig;
};

// FreeLLMAPI routes `auto` to whichever free model still has quota.
const FREE_LLM_MODEL = "auto";

class FreeLlmTextAdapter extends OpenAIBaseChatCompletionsTextAdapter<string> {
	constructor({ baseUrl, apiKey }: FreeLlmConfig) {
		super(
			FREE_LLM_MODEL,
			LLM_PROVIDER.FREELLMAPI,
			new OpenAI({ baseURL: baseUrl, apiKey }),
		);
	}
}

const textAdapters = {
	[LLM_PROVIDER.OPENAI]: () => openaiText("gpt-5.5"),
	[LLM_PROVIDER.FREELLMAPI]: (freeLlm: FreeLlmConfig) =>
		new FreeLlmTextAdapter(freeLlm),
} satisfies Record<LlmProvider, (freeLlm: FreeLlmConfig) => AnyTextAdapter>;

export const createTextAdapter = ({
	provider,
	freeLlm,
}: TextAdapterConfig): AnyTextAdapter => textAdapters[provider](freeLlm);
