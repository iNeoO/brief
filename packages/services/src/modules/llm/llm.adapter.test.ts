import { LLM_PROVIDER } from "@brief/common/constants";
import { chat, toolDefinition } from "@tanstack/ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTextAdapter } from "./llm.adapter.js";

const FREE_LLM = {
	baseUrl: "http://freellmapi:3001/v1",
	apiKey: "freellmapi-client-key",
	model: "gemini-3.5-flash",
};

const PING_TOOL = toolDefinition({
	name: "ping",
	description: "Answers pong",
	inputSchema: z.object({}),
}).server(async () => "pong");

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

		const adapter = createTextAdapter({ provider: LLM_PROVIDER.OPENAI });

		expect(adapter).toMatchObject({ name: "openai", model: "gpt-5.5" });
	});

	it("prompts the OpenAI model it is given", () => {
		vi.stubEnv("OPENAI_API_KEY", "sk-test");

		const adapter = createTextAdapter({
			provider: LLM_PROVIDER.OPENAI,
			openai: { model: "gpt-5.4-mini" },
		});

		expect(adapter).toMatchObject({ name: "openai", model: "gpt-5.4-mini" });
	});

	it("prompts FreeLLMAPI's pinned model with the brief key", async () => {
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
		expect(JSON.parse(String(init?.body))).toMatchObject({
			model: "gemini-3.5-flash",
		});
	});

	it("asks FreeLLMAPI for tools and the output schema in separate requests", async () => {
		const fetchMock = vi
			.fn(async (_url: string, _init: RequestInit) =>
				streamedReply('{"ok":true}'),
			)
			.mockResolvedValueOnce(streamedReply("done"));
		vi.stubGlobal("fetch", fetchMock);

		await chat({
			adapter: createTextAdapter({
				provider: LLM_PROVIDER.FREELLMAPI,
				freeLlm: FREE_LLM,
			}),
			stream: false,
			messages: [{ role: "user", content: "ping" }],
			tools: [PING_TOOL],
			outputSchema: z.object({ ok: z.boolean() }),
		});

		const [toolTurn, schemaTurn] = fetchMock.mock.calls.map(([, init]) =>
			JSON.parse(String(init?.body)),
		);
		expect(toolTurn).toHaveProperty("tools");
		expect(toolTurn).not.toHaveProperty("response_format");
		expect(schemaTurn).toHaveProperty("response_format");
		expect(schemaTurn).not.toHaveProperty("tools");
	});

	it("combines them in one request only when told to", async () => {
		const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
			streamedReply('{"ok":true}'),
		);
		vi.stubGlobal("fetch", fetchMock);

		await chat({
			adapter: createTextAdapter({
				provider: LLM_PROVIDER.FREELLMAPI,
				freeLlm: { ...FREE_LLM, combinedToolsAndSchema: true },
			}),
			stream: false,
			messages: [{ role: "user", content: "ping" }],
			tools: [PING_TOOL],
			outputSchema: z.object({ ok: z.boolean() }),
		});

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(
			JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)),
		).toMatchObject({
			tools: expect.any(Array),
			response_format: expect.any(Object),
		});
	});
});
