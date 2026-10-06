import { LLM_PROVIDER } from "@brief/common/constants";
import type { AnyTextAdapter } from "@tanstack/ai";
import { type OpenAIChatModel, openaiText } from "@tanstack/ai-openai";
import { OpenAIBaseChatCompletionsTextAdapter } from "@tanstack/openai-base";
// TanStack's adapters are typed against openai v6; the app's own SDK is v7.
import OpenAI from "openai-tanstack";

export { OPENAI_CHAT_MODELS as OPENAI_TEXT_MODELS } from "@tanstack/ai-openai";

export const DEFAULT_OPENAI_MODEL = "gpt-5.5" satisfies OpenAIChatModel;

export type OpenAiConfig = { model?: OpenAIChatModel };

type FreeLlmConfig = {
	baseUrl: string;
	apiKey: string;
	model: string;
	combinedToolsAndSchema?: boolean;
	maxRetries?: number;
	fetch?: typeof globalThis.fetch;
};

export type TextAdapterConfig =
	| { provider: typeof LLM_PROVIDER.OPENAI; openai?: OpenAiConfig }
	| { provider: typeof LLM_PROVIDER.FREELLMAPI; freeLlm: FreeLlmConfig };

class FreeLlmTextAdapter extends OpenAIBaseChatCompletionsTextAdapter<string> {
	private readonly combinedToolsAndSchema: boolean;

	constructor({
		baseUrl,
		apiKey,
		model,
		// Tools plus a strict response_format in one request let a grammar-constrained upstream answer before calling any tool.
		combinedToolsAndSchema = false,
		maxRetries,
		fetch,
	}: FreeLlmConfig) {
		super(
			model,
			LLM_PROVIDER.FREELLMAPI,
			new OpenAI({ baseURL: baseUrl, apiKey, maxRetries, fetch }),
		);
		this.combinedToolsAndSchema = combinedToolsAndSchema;
	}

	override supportsCombinedToolsAndSchema() {
		return this.combinedToolsAndSchema;
	}
}

export const createTextAdapter = (config: TextAdapterConfig): AnyTextAdapter =>
	config.provider === LLM_PROVIDER.FREELLMAPI
		? new FreeLlmTextAdapter(config.freeLlm)
		: openaiText(config.openai?.model ?? DEFAULT_OPENAI_MODEL);
