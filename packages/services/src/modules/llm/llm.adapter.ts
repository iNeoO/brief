import { LLM_PROVIDER } from "@brief/common/constants";
import type { LlmProvider } from "@brief/common/types";
import type { AnyTextAdapter } from "@tanstack/ai";
import { type OpenAIChatModel, openaiText } from "@tanstack/ai-openai";
import { OpenAIBaseChatCompletionsTextAdapter } from "@tanstack/openai-base";
// TanStack's adapters are typed against openai v6; the app's own SDK is v7.
import OpenAI from "openai-tanstack";

type FreeLlmConfig = { baseUrl: string; apiKey: string };

export { OPENAI_CHAT_MODELS as OPENAI_TEXT_MODELS } from "@tanstack/ai-openai";

export const DEFAULT_OPENAI_MODEL = "gpt-5.5" satisfies OpenAIChatModel;

export type OpenAiConfig = { model?: OpenAIChatModel };

export type TextAdapterConfig = {
	provider: LlmProvider;
	freeLlm: FreeLlmConfig;
	openai?: OpenAiConfig;
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
	[LLM_PROVIDER.OPENAI]: ({ openai }: TextAdapterConfig) =>
		openaiText(openai?.model ?? DEFAULT_OPENAI_MODEL),
	[LLM_PROVIDER.FREELLMAPI]: ({ freeLlm }) => new FreeLlmTextAdapter(freeLlm),
} satisfies Record<LlmProvider, (config: TextAdapterConfig) => AnyTextAdapter>;

export const createTextAdapter = (config: TextAdapterConfig): AnyTextAdapter =>
	textAdapters[config.provider](config);
