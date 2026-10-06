import type { ChatMiddleware } from "@tanstack/ai";

export const createRunErrorCollector = () => {
	let upstream: string | undefined;

	const middleware: ChatMiddleware = {
		name: "run-error",
		onChunk: (_ctx, chunk) => {
			if (chunk.type === "RUN_ERROR") upstream = chunk.message;
		},
	};

	return {
		middleware,
		// chat() reports a refused request as a missing structured output; the router's reason is the useful part.
		explain: (err: unknown) =>
			upstream && err instanceof Error
				? new Error(`${err.message} ← ${upstream}`, { cause: err })
				: err,
	};
};
