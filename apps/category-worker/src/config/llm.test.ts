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
	OPENAI_SELECTION_MODEL: "",
};

const loadLlmConfig = async (overrides: Record<string, string>) => {
	for (const [name, value] of Object.entries({ ...VARS, ...overrides })) {
		vi.stubEnv(name, value);
	}
	vi.resetModules();
	return import("./llm.js");
};

const configuredAdapters = async (overrides: Record<string, string> = {}) =>
	(await loadLlmConfig(overrides)).createConfiguredTextAdapters();

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("createConfiguredTextAdapters", () => {
	it("refuses FreeLLMAPI without a pinned model", async () => {
		await expect(
			configuredAdapters({ LLM_PROVIDER: "freellmapi", FREE_LLM_MODEL: "" }),
		).rejects.toThrow(/FREE_LLM_MODEL/);
	});

	it("selects with OPENAI_SELECTION_MODEL and writes with OPENAI_MODEL", async () => {
		await expect(
			configuredAdapters({
				OPENAI_MODEL: "gpt-5.5",
				OPENAI_SELECTION_MODEL: "gpt-5.4-mini",
			}),
		).resolves.toMatchObject({
			selection: { name: "openai", model: "gpt-5.4-mini" },
			summary: { name: "openai", model: "gpt-5.5" },
		});
	});

	it("selects with OPENAI_MODEL when no selection model is set", async () => {
		await expect(
			configuredAdapters({ OPENAI_MODEL: "gpt-5.5" }),
		).resolves.toMatchObject({
			selection: { model: "gpt-5.5" },
			summary: { model: "gpt-5.5" },
		});
	});

	it("keeps FreeLLMAPI's pinned model for both steps", async () => {
		await expect(
			configuredAdapters({
				LLM_PROVIDER: "freellmapi",
				FREE_LLM_MODEL: "gemini-3.5-flash",
				OPENAI_SELECTION_MODEL: "gpt-5.4-mini",
			}),
		).resolves.toMatchObject({
			selection: { name: "freellmapi", model: "gemini-3.5-flash" },
			summary: { name: "freellmapi", model: "gemini-3.5-flash" },
		});
	});
});
