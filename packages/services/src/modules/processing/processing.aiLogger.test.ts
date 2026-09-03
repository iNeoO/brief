import type { PinoLogger } from "@brief/infra/libs";
import { describe, expect, it, vi } from "vitest";
import { createAiDebugLogger } from "./processing.aiLogger.js";

const LEVELS = ["debug", "info", "warn", "error"] as const;

describe("createAiDebugLogger", () => {
	it("flips the argument order pino expects", () => {
		// The AI runtime logs `(message, meta)`; pino wants `(meta, message)`, and
		// a message passed first would swallow the metadata.
		for (const level of LEVELS) {
			const spy = vi.fn();
			const logger = createAiDebugLogger({
				[level]: spy,
			} as unknown as PinoLogger);

			logger[level]("tool call", { tool: "getArticles" });

			expect(spy).toHaveBeenCalledWith({ tool: "getArticles" }, "tool call");
		}
	});

	it("passes an absent meta straight through", () => {
		const info = vi.fn();
		const logger = createAiDebugLogger({ info } as unknown as PinoLogger);

		logger.info("no metadata here");

		expect(info).toHaveBeenCalledWith(undefined, "no metadata here");
	});
});
