import { getLoggerStore } from "@brief/infra/libs";
import type { ChatMiddleware } from "@tanstack/ai";

export type TokenUsageTotals = {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
};

const emptyTokenUsage = (): TokenUsageTotals => ({
	promptTokens: 0,
	completionTokens: 0,
	totalTokens: 0,
});

/**
 * Counts what one `chat()` call actually spent.
 *
 * The totals are summed per iteration rather than read off the result: `onUsage`
 * fires once per model iteration, and the run's own `RUN_FINISHED` carries only
 * the last one. An agent loop that fetched ten articles over four turns would
 * otherwise report its fourth turn as the price of the whole call.
 *
 * `iterations` is the other half of the answer — what the loop really consumed.
 * A call that quietly ran out of turns shows up here as a round number against
 * its own ceiling, long before the summary it produced looks odd.
 */
export const createUsageCollector = (call: string) => {
	const totals = emptyTokenUsage();
	let iterations = 0;

	const middleware: ChatMiddleware = {
		name: "usage",
		onIteration: () => {
			iterations += 1;
		},
		onUsage: (_ctx, usage) => {
			totals.promptTokens += usage.promptTokens;
			totals.completionTokens += usage.completionTokens;
			totals.totalTokens += usage.totalTokens;
		},
	};

	return {
		middleware,
		/** Reports the run at `info` and returns its totals. */
		report(): TokenUsageTotals {
			getLoggerStore().info({ call, ...totals, iterations }, "llm usage");
			return { ...totals };
		},
	};
};
