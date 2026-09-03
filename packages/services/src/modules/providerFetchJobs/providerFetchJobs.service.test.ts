import { JOB_STATUS, MAX_JOB_RETRY } from "@brief/common/constants";
import { and, eq, ne, schema } from "@brief/drizzle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	asDatabase,
	fakeTransaction,
	recordingChain,
} from "../../testing/db.fake.js";
import { ProviderFetchJobsService } from "./providerFetchJobs.service.js";

const JOB_ID = 7;
const CATEGORY_JOB_ID = 42;
const PROVIDER_ID = "provider-1";
const NOW = new Date("2026-08-17T06:30:00.000Z");

type Rows = {
	/** What `update(...).returning()` hands back; empty stands for a guard that refused. */
	updated?: Record<string, unknown>[];
	/** The `provider_fetch_jobs` row the transactions read before they write. */
	current?: Record<string, unknown>[];
	/** The provider the claimed job points at. */
	provider?: Record<string, unknown>[];
	/** The fetch jobs of a category job that are not finished yet. */
	unfinished?: Record<string, unknown>[];
};

const harness = (rows: Rows = {}) => {
	const update = recordingChain(rows.updated ?? [{ id: JOB_ID }]);
	const insert = recordingChain();
	const reads = {
		providerFetchJobs: recordingChain(rows.current ?? []),
		providers: recordingChain(rows.provider ?? []),
		unfinished: recordingChain(rows.unfinished ?? []),
	};

	const from = (table: unknown) => {
		if (table === schema.providers) return reads.providers;
		if (table === schema.categoryJobProviderFetchJobs) return reads.unfinished;
		return reads.providerFetchJobs;
	};

	const tx = {
		update: (table: unknown) => update.update(table),
		insert: (table: unknown) => insert.insert(table),
		select: () => ({ from }),
	};

	return {
		update,
		insert,
		reads,
		service: new ProviderFetchJobsService(
			asDatabase({ ...tx, ...fakeTransaction(tx) }),
		),
	};
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

describe("claimJob", () => {
	it("takes a pending job and hands back the feed to read", async () => {
		const { service, update } = harness({
			updated: [{ id: JOB_ID, providerId: PROVIDER_ID }],
			provider: [{ id: PROVIDER_ID, url: "https://example.test/rss" }],
		});

		await expect(service.claimJob(JOB_ID)).resolves.toEqual({
			id: JOB_ID,
			providerId: PROVIDER_ID,
			provider: { id: PROVIDER_ID, url: "https://example.test/rss" },
		});

		expect(update.args("set")).toEqual([{ status: JOB_STATUS.RUNNING }]);
		expect(update.args("where")).toEqual([
			and(
				eq(schema.providerFetchJobs.id, JOB_ID),
				eq(schema.providerFetchJobs.status, JOB_STATUS.PENDING),
			),
		]);
	});

	it("returns nothing, and reads nothing, when the job was already claimed", async () => {
		const { service, reads } = harness({ updated: [] });

		await expect(service.claimJob(JOB_ID)).resolves.toBeUndefined();
		expect(reads.providers.calls).toEqual([]);
	});

	it("still claims the job when the provider row has gone", async () => {
		// Unlike a category job, a fetch job with no provider is handed back with
		// an undefined `provider` rather than rolled back: the caller decides.
		const { service } = harness({
			updated: [{ id: JOB_ID, providerId: PROVIDER_ID }],
			provider: [],
		});

		await expect(service.claimJob(JOB_ID)).resolves.toEqual({
			id: JOB_ID,
			providerId: PROVIDER_ID,
			provider: undefined,
		});
	});
});

describe("areAllProvidersFinished", () => {
	it("says yes once nothing unfinished is left", async () => {
		const { service, reads } = harness({ unfinished: [] });

		await expect(
			service.areAllProvidersFinished(CATEGORY_JOB_ID),
		).resolves.toBe(true);

		// A failed fetch counts as unfinished, so the category job keeps waiting.
		expect(reads.unfinished.args("where")).toEqual([
			and(
				eq(schema.categoryJobProviderFetchJobs.categoryJobId, CATEGORY_JOB_ID),
				ne(schema.providerFetchJobs.status, JOB_STATUS.FINISHED),
			),
		]);
		// One row is enough to answer: the query stops there.
		expect(reads.unfinished.args("limit")).toEqual([1]);
	});

	it("says no while one fetch is still outstanding", async () => {
		const { service } = harness({ unfinished: [{ id: JOB_ID }] });

		await expect(
			service.areAllProvidersFinished(CATEGORY_JOB_ID),
		).resolves.toBe(false);
	});
});

describe("markFinished", () => {
	it("settles a running fetch and clears its error", async () => {
		const { service, update } = harness();

		await expect(service.markFinished(JOB_ID)).resolves.toEqual([
			{ id: JOB_ID },
		]);

		expect(update.args("set")).toEqual([
			{
				status: JOB_STATUS.FINISHED,
				error: null,
				retry: 0,
				finishedAt: NOW,
			},
		]);
		expect(update.args("where")).toEqual([
			and(
				eq(schema.providerFetchJobs.id, JOB_ID),
				eq(schema.providerFetchJobs.status, JOB_STATUS.RUNNING),
			),
		]);
	});

	it("returns nothing when the job was not running", async () => {
		const { service } = harness({ updated: [] });

		await expect(service.markFinished(JOB_ID)).resolves.toEqual([]);
	});
});

describe("incrementRetry", () => {
	it("hands the fetch back to the queue while retries are left", async () => {
		const { service, update, insert } = harness({ current: [{ retry: 0 }] });

		await expect(service.incrementRetry(JOB_ID, "502")).resolves.toEqual({
			id: JOB_ID,
		});

		expect(update.args("set")).toEqual([
			{ error: "502", retry: 1, status: JOB_STATUS.PENDING, finishedAt: null },
		]);
		expect(insert.args("insert")).toEqual([schema.providerFetchJobEvents]);
		expect(insert.args("values")).toEqual([
			{
				providerFetchJobId: JOB_ID,
				attempt: 1,
				status: JOB_STATUS.FAILED,
				error: "502",
			},
		]);
	});

	it("fails the fetch for good on the last attempt", async () => {
		const { service, update } = harness({
			current: [{ retry: MAX_JOB_RETRY - 1 }],
		});

		await service.incrementRetry(JOB_ID, "502");

		expect(update.args("set")).toEqual([
			{
				error: "502",
				retry: MAX_JOB_RETRY,
				status: JOB_STATUS.FAILED,
				finishedAt: NOW,
			},
		]);
	});

	it("writes nothing when the job no longer exists", async () => {
		const { service, update, insert } = harness({ current: [] });

		await expect(service.incrementRetry(JOB_ID, "502")).resolves.toBeNull();
		expect(update.calls).toEqual([]);
		expect(insert.calls).toEqual([]);
	});
});
