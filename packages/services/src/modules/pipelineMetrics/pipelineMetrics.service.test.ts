import { CATEGORY_JOB_STATUS, JOB_STATUS } from "@brief/common/constants";
import { eq, schema } from "@brief/drizzle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDatabase, recordingChain } from "../../testing/db.fake.js";
import { PipelineMetricsService } from "./pipelineMetrics.service.js";

const TARGET_DATE = new Date("2026-08-17T00:00:00.000Z");

type CategoryRow = {
	status: string;
	count: number;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
};

const categoryRow = (overrides: Partial<CategoryRow> = {}): CategoryRow => ({
	status: CATEGORY_JOB_STATUS.FINISHED,
	count: 1,
	promptTokens: 0,
	completionTokens: 0,
	totalTokens: 0,
	...overrides,
});

/**
 * The three counts run in parallel off the same `select`, so the fake hands a
 * distinct chain per table: each keeps its own rows and its own clauses.
 */
const counts = (rows: {
	category?: CategoryRow[];
	fetch?: { status: string; count: number }[];
	message?: { status: string; count: number }[];
}) => {
	const category = recordingChain(rows.category ?? []);
	const fetch = recordingChain(rows.fetch ?? []);
	const message = recordingChain(rows.message ?? []);

	const from = (table: unknown) => {
		if (table === schema.categoryJobs) return category;
		if (table === schema.providerFetchJobs) return fetch;
		return message;
	};

	const db = asDatabase({ select: () => ({ from }) });

	return {
		category,
		fetch,
		message,
		run: () => new PipelineMetricsService(db).getDailyCounts(TARGET_DATE),
	};
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("getDailyCounts", () => {
	it("counts the day's jobs per status and sums the tokens they spent", async () => {
		const metrics = counts({
			category: [
				categoryRow({
					status: CATEGORY_JOB_STATUS.FINISHED,
					count: 2,
					promptTokens: 1_000,
					completionTokens: 100,
					totalTokens: 1_100,
				}),
				categoryRow({
					status: CATEGORY_JOB_STATUS.FAILED,
					count: 1,
					promptTokens: 500,
					completionTokens: 50,
					totalTokens: 550,
				}),
			],
			fetch: [{ status: JOB_STATUS.FINISHED, count: 4 }],
			message: [{ status: JOB_STATUS.PENDING, count: 3 }],
		});

		await expect(metrics.run()).resolves.toEqual({
			categoryJobs: {
				waiting_for_providers: 0,
				pending: 0,
				running: 0,
				finished: 2,
				failed: 1,
				no_articles_selected: 0,
			},
			providerFetchJobs: { pending: 0, running: 0, finished: 4, failed: 0 },
			messageJobs: { pending: 3, running: 0, finished: 0, failed: 0 },
			tokens: { prompt: 1_500, completion: 150, total: 1_650 },
		});
	});

	it("reports a zero for every status the day never reached", async () => {
		// Prometheus reads a series that stops being exposed as "no data", not as
		// "none left", so a gauge that disappears leaves the alert firing on the
		// last value it saw.
		await expect(counts({}).run()).resolves.toEqual({
			categoryJobs: {
				waiting_for_providers: 0,
				pending: 0,
				running: 0,
				finished: 0,
				failed: 0,
				no_articles_selected: 0,
			},
			providerFetchJobs: { pending: 0, running: 0, finished: 0, failed: 0 },
			messageJobs: { pending: 0, running: 0, finished: 0, failed: 0 },
			tokens: { prompt: 0, completion: 0, total: 0 },
		});
	});

	it("scopes all three counts to the target date", async () => {
		// An unfiltered count would keep every failure ever recorded in the
		// gauge, so an alert on `failed > 0` would never clear again.
		const metrics = counts({});
		await metrics.run();

		expect(metrics.category.args("where")).toEqual([
			eq(schema.categoryJobs.targetDate, TARGET_DATE),
		]);
		expect(metrics.fetch.args("where")).toEqual([
			eq(schema.providerFetchJobs.targetDate, TARGET_DATE),
		]);
		// Message jobs carry no date of their own: they are dated through the
		// category job they deliver, hence the join.
		expect(metrics.message.args("innerJoin")).toEqual([
			schema.categoryJobs,
			eq(schema.categoryJobs.id, schema.messageJobs.categoryJobId),
		]);
		expect(metrics.message.args("where")).toEqual([
			eq(schema.categoryJobs.targetDate, TARGET_DATE),
		]);
	});

	it("groups each count by status", async () => {
		const metrics = counts({});
		await metrics.run();

		expect(metrics.category.args("groupBy")).toEqual([
			schema.categoryJobs.status,
		]);
		expect(metrics.fetch.args("groupBy")).toEqual([
			schema.providerFetchJobs.status,
		]);
		expect(metrics.message.args("groupBy")).toEqual([
			schema.messageJobs.status,
		]);
	});
});
