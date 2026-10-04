import { InternalError } from "@brief/infra/errors";
import { describe, expect, it, vi } from "vitest";
import { withDeadline } from "./withDeadline.helper.js";

const options = {
	context: "Article selection",
	timeoutMs: 10,
	timeoutCode: "AI_TIMEOUT",
} as const;

describe("withDeadline", () => {
	it("returns what the run returns", async () => {
		await expect(
			withDeadline({ ...options, run: async () => "brief" }),
		).resolves.toBe("brief");
	});

	it("aborts the controller once the deadline passes", async () => {
		const aborted = await withDeadline({
			...options,
			run: (abortController) =>
				new Promise<boolean>((resolve) => {
					abortController.signal.addEventListener("abort", () => resolve(true));
				}),
		});

		expect(aborted).toBe(true);
	});

	it("reports a run that failed after the abort as a timeout", async () => {
		const run = (abortController: AbortController) =>
			new Promise<never>((_, reject) => {
				abortController.signal.addEventListener("abort", () =>
					// What `chat()` does with a cancelled run: it throws about the
					// missing structured output, never about the abort.
					reject(
						new Error("structured output finalization produced no result"),
					),
				);
			});

		const err = await withDeadline({ ...options, run }).catch((e) => e);

		expect(err).toBeInstanceOf(InternalError);
		expect(err.code).toBe("AI_TIMEOUT");
		expect(err.message).toBe("Article selection passed its 10ms deadline");
	});

	it("leaves a failure of its own alone", async () => {
		const err = new Error("429 Too Many Requests");

		await expect(
			withDeadline({ ...options, run: () => Promise.reject(err) }),
		).rejects.toBe(err);
	});

	it("clears its timer when the run settles first", async () => {
		vi.useFakeTimers();
		try {
			const clear = vi.spyOn(globalThis, "clearTimeout");
			await withDeadline({ ...options, run: async () => "brief" });
			expect(clear).toHaveBeenCalled();
		} finally {
			vi.useRealTimers();
		}
	});
});
