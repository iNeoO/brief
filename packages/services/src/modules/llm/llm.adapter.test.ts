import { LLM_PROVIDER } from "@brief/common/constants";
import { chat } from "@tanstack/ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTextAdapter } from "./llm.adapter.js";

const FREE_LLM = {
	baseUrl: "http://freellmapi:3001/v1",
	apiKey: "freellmapi-client-key",
};

const streamedReply = (content: string) => {
	const chunk = (delta: object, finishReason: string | null) =>
		`data: ${JSON.stringify({
			id: "chatcmpl-1",
			object: "chat.completion.chunk",
			created: 0,
			model: "gemini-2.5-flash",
			choices: [{ index: 0, delta, finish_reason: finishReason }],
		})}\n\n`;

	return new Response(
		chunk({ role: "assistant", content }, null) +
			chunk({}, "stop") +
			"data: [DONE]\n\n",
		{ headers: { "content-type": "text/event-stream" } },
	);
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("createTextAdapter", () => {
	it("keeps prompting OpenAI's gpt-5.5 when OpenAI is the provider", () => {
		vi.stubEnv("OPENAI_API_KEY", "sk-test");

		const adapter = createTextAdapter({
			provider: LLM_PROVIDER.OPENAI,
			freeLlm: FREE_LLM,
		});

		expect(adapter).toMatchObject({ name: "openai", model: "gpt-5.5" });
	});

	it("prompts FreeLLMAPI with the brief key and lets its router pick the model", async () => {
		const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
			streamedReply("pong"),
		);
		vi.stubGlobal("fetch", fetchMock);

		const adapter = createTextAdapter({
			provider: LLM_PROVIDER.FREELLMAPI,
			freeLlm: FREE_LLM,
		});
		const reply = await chat({
			adapter,
			stream: false,
			messages: [{ role: "user", content: "ping" }],
		});

		expect(reply).toBe("pong");
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(url).toBe("http://freellmapi:3001/v1/chat/completions");
		expect(new Headers(init?.headers).get("authorization")).toBe(
			"Bearer freellmapi-client-key",
		);
		expect(JSON.parse(String(init?.body))).toMatchObject({ model: "auto" });
	});
});
