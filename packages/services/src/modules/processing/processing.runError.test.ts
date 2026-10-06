import type { ChatMiddlewareContext, StreamChunk } from "@tanstack/ai";
import { describe, expect, it } from "vitest";
import { createRunErrorCollector } from "./processing.runError.js";

const receive = (
	collector: ReturnType<typeof createRunErrorCollector>,
	chunk: { type: string; message?: string },
) =>
	collector.middleware.onChunk?.(
		{} as ChatMiddlewareContext,
		chunk as StreamChunk,
	);

describe("createRunErrorCollector", () => {
	it("adds the router's reason to the error chat() threw", () => {
		const collector = createRunErrorCollector();
		receive(collector, {
			type: "RUN_ERROR",
			message: "429 All models exhausted",
		});

		expect(collector.explain(new Error("no result"))).toHaveProperty(
			"message",
			"no result ← 429 All models exhausted",
		);
	});

	it("leaves the error alone when the run reported nothing", () => {
		const collector = createRunErrorCollector();
		receive(collector, { type: "TEXT_MESSAGE_CONTENT" });
		const err = new Error("no result");

		expect(collector.explain(err)).toBe(err);
	});

	it("leaves a thrown value that is not an Error alone", () => {
		const collector = createRunErrorCollector();
		receive(collector, { type: "RUN_ERROR", message: "429" });

		expect(collector.explain("aborted")).toBe("aborted");
	});
});
