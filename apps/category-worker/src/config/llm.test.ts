import { afterEach, describe, expect, it, vi } from "vitest";

const VARS = {
	WORKER_ID: "category-worker-1",
	PG_URL: "postgres://brief:brief@localhost:5432/brief",
	AMQP_URL: "amqp://localhost:5672",
	CATEGORY_QUEUE: "category-jobs",
	MESSAGE_JOB_QUEUE: "message-jobs",
	FREE_LLM_API_URL: "http://freellmapi:3001/v1",
	FREE_LLM_API_KEY: "freellmapi-client-key",
	OPENAI_API_KEY: "sk-test",
	LLM_PROVIDER: "openai",
};

const configuredAdapter = async (overrides: Record<string, string> = {}) => {
	for (const [name, value] of Object.entries({ ...VARS, ...overrides })) {
		vi.stubEnv(name, value);
	}
	vi.resetModules();
	return (await import("./llm.js")).createConfiguredTextAdapter();
};

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("createConfiguredTextAdapter", () => {
	it("prompts the configured OpenAI model", async () => {
		await expect(
			configuredAdapter({ OPENAI_MODEL: "gpt-5.4-mini" }),
		).resolves.toMatchObject({ name: "openai", model: "gpt-5.4-mini" });
	});

	it("prompts FreeLLMAPI's pinned model", async () => {
		await expect(
			configuredAdapter({
				LLM_PROVIDER: "freellmapi",
				FREE_LLM_MODEL: "gemini-3.5-flash",
			}),
		).resolves.toMatchObject({
			name: "freellmapi",
			model: "gemini-3.5-flash",
		});
	});

	it("refuses FreeLLMAPI without a pinned model", async () => {
		await expect(
			configuredAdapter({ LLM_PROVIDER: "freellmapi", FREE_LLM_MODEL: "" }),
		).rejects.toThrow(/FREE_LLM_MODEL/);
	});
});
