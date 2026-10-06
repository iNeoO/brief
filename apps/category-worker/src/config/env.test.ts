import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VARS = {
	WORKER_ID: "category-worker-1",
	PG_URL: "postgres://brief:brief@localhost:5432/brief",
	AMQP_URL: "amqp://localhost:5672",
	CATEGORY_QUEUE: "category-jobs",
	MESSAGE_JOB_QUEUE: "message-jobs",
	FREE_LLM_API_URL: "http://freellmapi:3001/v1",
	FREE_LLM_API_KEY: "freellmapi-client-key",
} as const;

type Overrides = Partial<
	Record<
		| keyof typeof VARS
		| "LLM_PROVIDER"
		| "OPENAI_MODEL"
		| "OPENAI_SELECTION_MODEL"
		| "FREE_LLM_MODEL",
		string | undefined
	>
>;

/**
 * The module parses `process.env` as it loads, so each case stubs the
 * environment and imports it again from scratch.
 */
const load = async (overrides: Overrides = {}) => {
	for (const [name, value] of Object.entries({ ...VARS, ...overrides })) {
		vi.stubEnv(name, value);
	}

	vi.resetModules();
	return (await import("./env.js")).env;
};

beforeEach(() => {
	vi.unstubAllEnvs();
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("the worker environment", () => {
	it("reads the settings the worker runs on", async () => {
		await expect(load()).resolves.toEqual(expect.objectContaining(VARS));
	});

	it("refuses to start when a setting is missing", async () => {
		// Failing at import is the point: a worker with no queue name would
		// otherwise start, consume nothing, and still look healthy.
		await expect(load({ CATEGORY_QUEUE: undefined })).rejects.toThrow(
			/CATEGORY_QUEUE/,
		);
	});

	it("refuses an empty setting as firmly as a missing one", async () => {
		await expect(load({ AMQP_URL: "" })).rejects.toThrow(/AMQP_URL/);
	});

	it("prompts OpenAI unless told otherwise", async () => {
		await expect(load()).resolves.toEqual(
			expect.objectContaining({ LLM_PROVIDER: "openai" }),
		);
	});

	it("prompts FreeLLMAPI's pinned model when it is the chosen provider", async () => {
		await expect(
			load({ LLM_PROVIDER: "freellmapi", FREE_LLM_MODEL: "gemini-3.5-flash" }),
		).resolves.toEqual(
			expect.objectContaining({
				LLM_PROVIDER: "freellmapi",
				FREE_LLM_MODEL: "gemini-3.5-flash",
			}),
		);
	});

	it("ignores the empty model the example env ships when OpenAI answers", async () => {
		await expect(load({ FREE_LLM_MODEL: "" })).resolves.toEqual(
			expect.objectContaining({ LLM_PROVIDER: "openai" }),
		);
	});

	it("refuses FreeLLMAPI without a pinned model", async () => {
		await expect(load({ LLM_PROVIDER: "freellmapi" })).rejects.toThrow(
			/FREE_LLM_MODEL/,
		);
	});

	it("refuses FreeLLMAPI's auto routing", async () => {
		// `auto` picked a model that skipped getArticles on 2026-10-06 and emptied every brief.
		await expect(
			load({ LLM_PROVIDER: "freellmapi", FREE_LLM_MODEL: "auto:fast" }),
		).rejects.toThrow(/FREE_LLM_MODEL/);
	});

	it("refuses a provider it does not know", async () => {
		await expect(load({ LLM_PROVIDER: "mistral" })).rejects.toThrow(
			/LLM_PROVIDER/,
		);
	});

	it("prompts gpt-5.5 unless told otherwise", async () => {
		await expect(load()).resolves.toEqual(
			expect.objectContaining({ OPENAI_MODEL: "gpt-5.5" }),
		);
	});

	it("prompts the OpenAI model it is given", async () => {
		await expect(load({ OPENAI_MODEL: "gpt-5.4-mini" })).resolves.toEqual(
			expect.objectContaining({ OPENAI_MODEL: "gpt-5.4-mini" }),
		);
	});

	it("refuses an OpenAI model it does not know", async () => {
		await expect(load({ OPENAI_MODEL: "gpt-5.5-turbo" })).rejects.toThrow(
			/OPENAI_MODEL/,
		);
	});

	it("leaves the selection model unset unless told otherwise", async () => {
		await expect(
			load({ OPENAI_SELECTION_MODEL: undefined }),
		).resolves.not.toHaveProperty("OPENAI_SELECTION_MODEL", expect.anything());
	});

	it("reads an empty selection model as unset, the way the example env ships it", async () => {
		await expect(load({ OPENAI_SELECTION_MODEL: "" })).resolves.toEqual(
			expect.objectContaining({ OPENAI_SELECTION_MODEL: undefined }),
		);
	});

	it("refuses a selection model it does not know", async () => {
		await expect(
			load({ OPENAI_SELECTION_MODEL: "gpt-5.5-turbo" }),
		).rejects.toThrow(/OPENAI_SELECTION_MODEL/);
	});

	it("refuses a FreeLLMAPI address that is not a URL", async () => {
		await expect(load({ FREE_LLM_API_URL: "freellmapi" })).rejects.toThrow(
			/FREE_LLM_API_URL/,
		);
	});
});
