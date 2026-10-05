import { LLM_PROVIDER } from "@brief/common/constants";
import { chat } from "@tanstack/ai";
import { env } from "../config/env.js";
import { createConfiguredTextAdapter } from "../config/llm.js";

const TIMEOUT_MS = 60_000;

const main = async () => {
	const target =
		env.LLM_PROVIDER === LLM_PROVIDER.FREELLMAPI
			? env.FREE_LLM_API_URL
			: "api.openai.com";
	console.log(`Prompting ${env.LLM_PROVIDER} at ${target}…`);

	const abortController = new AbortController();
	const timeout = setTimeout(() => abortController.abort(), TIMEOUT_MS);
	const startedAt = performance.now();

	try {
		let reply = "";
		// Streamed on purpose: the non-streamed text call swallows a RUN_ERROR and
		// resolves to an empty string, which would read as a working connection.
		for await (const chunk of chat({
			abortController,
			adapter: createConfiguredTextAdapter(),
			messages: [
				{ role: "user", content: "Answer with the single word: pong" },
			],
		})) {
			if (chunk.type === "RUN_ERROR") throw new Error(chunk.message);
			if (chunk.type === "TEXT_MESSAGE_CONTENT") reply += chunk.delta;
		}

		const elapsedMs = Math.round(performance.now() - startedAt);
		console.log(`Reply in ${elapsedMs} ms: ${reply}`);
	} finally {
		clearTimeout(timeout);
	}
};

try {
	await main();
} catch (error) {
	console.error("The model could not be reached:", error);
	process.exitCode = 1;
}
