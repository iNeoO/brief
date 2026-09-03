import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VARS = {
	WORKER_ID: "category-worker-1",
	PG_URL: "postgres://brief:brief@localhost:5432/brief",
	AMQP_URL: "amqp://localhost:5672",
	CATEGORY_QUEUE: "category-jobs",
	MESSAGE_JOB_QUEUE: "message-jobs",
} as const;

type Overrides = Partial<Record<keyof typeof VARS, string | undefined>>;

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
	it("reads the five settings the worker runs on", async () => {
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
});
