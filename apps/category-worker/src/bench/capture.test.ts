import { describe, expect, it } from "vitest";
import { assemble } from "./capture.js";

describe("assemble", () => {
	it("rebuilds a streamed tool call whose name is repeated on every delta", () => {
		const delta = (args: string) => ({
			choices: [
				{
					delta: {
						tool_calls: [
							{ index: 0, function: { name: "getArticles", arguments: args } },
						],
					},
				},
			],
		});

		const { toolCalls } = assemble([
			{
				choices: [
					{
						delta: {
							tool_calls: [
								{ index: 0, id: "call-1", function: { name: "getArticles" } },
							],
						},
					},
				],
			},
			delta('{"day":'),
			delta('"2026-10-06"}'),
		]);

		expect(toolCalls).toEqual([
			{ id: "call-1", name: "getArticles", arguments: '{"day":"2026-10-06"}' },
		]);
	});

	it("keeps the content, the finish reason and the usage of a streamed answer", () => {
		expect(
			assemble([
				{ choices: [{ delta: { content: '{"articles":' } }] },
				{ choices: [{ delta: { content: "[]}" }, finish_reason: "stop" }] },
				{ usage: { prompt_tokens: 1556, completion_tokens: 45 } },
			]),
		).toMatchObject({
			content: '{"articles":[]}',
			finishReason: "stop",
			promptTokens: 1556,
			completionTokens: 45,
		});
	});
});
