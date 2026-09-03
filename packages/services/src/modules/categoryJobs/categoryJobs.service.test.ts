import {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
	INTERNAL_ERROR_CODE,
	JOB_STATUS,
	MAX_JOB_RETRY,
} from "@brief/common/constants";
import { and, eq, schema, sql } from "@brief/drizzle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	asDatabase,
	fakeTransaction,
	recordingChain,
} from "../../testing/db.fake.js";
import { CategoryJobsService } from "./categoryJobs.service.js";

const JOB_ID = 42;
const CATEGORY_ID = "category-1";
const TARGET_DATE = new Date("2026-08-17T00:00:00.000Z");
const NOW = new Date("2026-08-17T06:30:00.000Z");

type Rows = {
	/** What `update(...).returning()` hands back; empty stands for a guard that refused. */
	updated?: Record<string, unknown>[];
	/** The `category_jobs` row the transactions read before they write. */
	current?: Record<string, unknown>[];
	/** The category-and-providers join `claimJob` runs. */
	category?: Record<string, unknown>[];
	/** The jobs waiting on a provider fetch. */
	waiting?: Record<string, unknown>[];
};

/**
 * The service reads and writes several tables in one transaction, so the fake
 * hands a distinct chain per query: each keeps its own rows and the clauses it
 * was given. Reads are dispatched on the table they select from.
 */
const harness = (rows: Rows = {}) => {
	const update = recordingChain(rows.updated ?? [{ id: JOB_ID }]);
	const insert = recordingChain();
	const reads = {
		categoryJobs: recordingChain(rows.current ?? []),
		categories: recordingChain(rows.category ?? []),
		waiting: recordingChain(rows.waiting ?? []),
	};

	const from = (table: unknown) => {
		if (table === schema.categories) return reads.categories;
		if (table === schema.categoryJobProviderFetchJobs) return reads.waiting;
		return reads.categoryJobs;
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
		service: new CategoryJobsService(
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
	const claimable = {
		updated: [{ id: JOB_ID, categoryId: CATEGORY_ID }],
		category: [
			{
				category: { id: CATEGORY_ID, name: "Actu France" },
				provider: { id: "provider-1" },
			},
			{
				category: { id: CATEGORY_ID, name: "Actu France" },
				provider: { id: "provider-2" },
			},
		],
	};

	it("takes a pending job and hands back its category and providers", async () => {
		const { service, update } = harness(claimable);

		await expect(service.claimJob(JOB_ID)).resolves.toEqual({
			id: JOB_ID,
			categoryId: CATEGORY_ID,
			category: {
				id: CATEGORY_ID,
				name: "Actu France",
				providers: [{ id: "provider-1" }, { id: "provider-2" }],
			},
		});

		expect(update.args("update")).toEqual([schema.categoryJobs]);
		expect(update.args("set")).toEqual([{ status: JOB_STATUS.RUNNING }]);
	});

	// Two workers can read the same message: only the one whose update matches a
	// still-pending row owns the job.
	it("only claims a job that is still pending", async () => {
		const { service, update } = harness(claimable);

		await service.claimJob(JOB_ID);

		expect(update.args("where")).toEqual([
			and(
				eq(schema.categoryJobs.id, JOB_ID),
				eq(schema.categoryJobs.status, JOB_STATUS.PENDING),
			),
		]);
	});

	it("returns nothing, and reads nothing, when the job was already claimed", async () => {
		const { service, reads } = harness({ updated: [] });

		await expect(service.claimJob(JOB_ID)).resolves.toBeUndefined();
		expect(reads.categories.calls).toEqual([]);
	});

	it("refuses a job whose category has vanished", async () => {
		// The row is already `running` at this point: the throw rolls the
		// transaction back rather than leaving a job nothing can process.
		const { service } = harness({ ...claimable, category: [] });

		await expect(service.claimJob(JOB_ID)).rejects.toMatchObject({
			code: INTERNAL_ERROR_CODE.CATEGORY_JOB_CATEGORY_NOT_FOUND,
		});
	});

	it("reports no provider when the category has none linked", async () => {
		// The left join answers with a null provider, which must become an empty
		// list rather than a list holding nothing.
		const { service } = harness({
			...claimable,
			category: [
				{ category: { id: CATEGORY_ID, name: "Actu France" }, provider: null },
			],
		});

		await expect(service.claimJob(JOB_ID)).resolves.toMatchObject({
			category: { providers: [] },
		});
	});
});

describe("findByCategoryAndDate", () => {
	it("looks up the run of one category on one day", async () => {
		const { service, reads } = harness({ current: [{ id: JOB_ID }] });

		await expect(
			service.findByCategoryAndDate(CATEGORY_ID, TARGET_DATE),
		).resolves.toEqual([{ id: JOB_ID }]);

		expect(reads.categoryJobs.args("where")).toEqual([
			and(
				eq(schema.categoryJobs.categoryId, CATEGORY_ID),
				eq(schema.categoryJobs.targetDate, TARGET_DATE),
			),
		]);
	});
});

describe("findWaitingByProviderFetchJob", () => {
	it("finds the jobs still waiting on that fetch", async () => {
		const { service, reads } = harness({ waiting: [{ id: JOB_ID }] });

		await expect(service.findWaitingByProviderFetchJob(7)).resolves.toEqual([
			{ id: JOB_ID },
		]);

		// A job that has moved on must not be woken again by a late fetch.
		expect(reads.waiting.args("where")).toEqual([
			and(
				eq(schema.categoryJobProviderFetchJobs.providerFetchJobId, 7),
				eq(
					schema.categoryJobs.status,
					CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS,
				),
			),
		]);
	});
});

describe("markReadyForProcessing", () => {
	it("moves a waiting job to pending", async () => {
		const { service, update } = harness();

		await expect(service.markReadyForProcessing(JOB_ID)).resolves.toEqual([
			{ id: JOB_ID },
		]);

		expect(update.args("set")).toEqual([
			{ status: CATEGORY_JOB_STATUS.PENDING },
		]);
		expect(update.args("where")).toEqual([
			and(
				eq(schema.categoryJobs.id, JOB_ID),
				eq(
					schema.categoryJobs.status,
					CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS,
				),
			),
		]);
	});

	it("returns nothing when the job was not waiting", async () => {
		const { service } = harness({ updated: [] });

		await expect(service.markReadyForProcessing(JOB_ID)).resolves.toEqual([]);
	});
});

describe("completeStep", () => {
	it("moves the job to the next step and records the attempt", async () => {
		const { service, update, insert } = harness({
			current: [{ retry: 1 }],
			updated: [{ id: JOB_ID, state: CATEGORY_JOB_STATE.CREATING_AUDIO }],
		});

		await expect(
			service.completeStep(
				JOB_ID,
				CATEGORY_JOB_STATE.CREATING_REPORT,
				CATEGORY_JOB_STATE.CREATING_AUDIO,
			),
		).resolves.toEqual({
			id: JOB_ID,
			state: CATEGORY_JOB_STATE.CREATING_AUDIO,
		});

		// A step that succeeded clears the error and gives the next one a full
		// budget of retries.
		expect(update.args("set")).toEqual([
			{ state: CATEGORY_JOB_STATE.CREATING_AUDIO, error: null, retry: 0 },
		]);
		expect(insert.args("insert")).toEqual([schema.categoryJobEvents]);
		expect(insert.args("values")).toEqual([
			{
				categoryJobId: JOB_ID,
				attempt: 2,
				state: CATEGORY_JOB_STATE.CREATING_REPORT,
				status: JOB_STATUS.FINISHED,
			},
		]);
	});

	it("leaves the job on the step it just finished when there is no next one", async () => {
		const { service, update } = harness({ current: [{ retry: 0 }] });

		await service.completeStep(JOB_ID, CATEGORY_JOB_STATE.SENDING_MESSAGE);

		expect(update.args("set")).toEqual([
			{ state: CATEGORY_JOB_STATE.SENDING_MESSAGE, error: null, retry: 0 },
		]);
	});

	it("only advances a running job that is still on that step", async () => {
		const { service, update } = harness({ current: [{ retry: 0 }] });

		await service.completeStep(JOB_ID, CATEGORY_JOB_STATE.CREATING_REPORT);

		expect(update.args("where")).toEqual([
			and(
				eq(schema.categoryJobs.id, JOB_ID),
				eq(schema.categoryJobs.status, JOB_STATUS.RUNNING),
				eq(schema.categoryJobs.state, CATEGORY_JOB_STATE.CREATING_REPORT),
			),
		]);
	});

	it("writes nothing when the job no longer exists", async () => {
		const { service, update, insert } = harness({ current: [] });

		await expect(
			service.completeStep(JOB_ID, CATEGORY_JOB_STATE.CREATING_REPORT),
		).resolves.toBeNull();

		expect(update.calls).toEqual([]);
		expect(insert.calls).toEqual([]);
	});

	it("records no event when the guard refused the update", async () => {
		// Another worker moved the job on: this one must not add an event for a
		// step it did not complete.
		const { service, insert } = harness({
			current: [{ retry: 0 }],
			updated: [],
		});

		await expect(
			service.completeStep(JOB_ID, CATEGORY_JOB_STATE.CREATING_REPORT),
		).resolves.toBeNull();

		expect(insert.calls).toEqual([]);
	});
});

describe("setReport", () => {
	it("stores the brief the report step produced", async () => {
		const { service, update } = harness();
		const report = { summary: "Le résumé du jour.", sources: "1. Titre — url" };

		await expect(service.setReport(JOB_ID, report)).resolves.toEqual([
			{ id: JOB_ID },
		]);

		expect(update.args("set")).toEqual([report]);
		expect(update.args("where")).toEqual([
			and(
				eq(schema.categoryJobs.id, JOB_ID),
				eq(schema.categoryJobs.status, JOB_STATUS.RUNNING),
				eq(schema.categoryJobs.state, CATEGORY_JOB_STATE.CREATING_REPORT),
			),
		]);
	});
});

describe("addTokenUsage", () => {
	const usage = {
		promptTokens: 1_000,
		completionTokens: 100,
		totalTokens: 1_100,
	};

	it("adds the call's cost to the totals rather than replacing them", async () => {
		// A job makes several calls and a retried step makes them again: every one
		// was billed, and two writers must not overwrite each other's figure.
		const { service, update } = harness();

		await expect(service.addTokenUsage(JOB_ID, usage)).resolves.toEqual({
			id: JOB_ID,
		});

		expect(update.args("set")).toEqual([
			{
				promptTokens: sql`${schema.categoryJobs.promptTokens} + ${usage.promptTokens}`,
				completionTokens: sql`${schema.categoryJobs.completionTokens} + ${usage.completionTokens}`,
				totalTokens: sql`${schema.categoryJobs.totalTokens} + ${usage.totalTokens}`,
			},
		]);
	});

	it("bills the job whatever state it is in", async () => {
		// Deliberately unguarded: the tokens were spent even if the job has since
		// failed or been moved on.
		const { service, update } = harness();

		await service.addTokenUsage(JOB_ID, usage);

		expect(update.args("where")).toEqual([eq(schema.categoryJobs.id, JOB_ID)]);
	});

	it("returns null when no job carries that id", async () => {
		const { service } = harness({ updated: [] });

		await expect(service.addTokenUsage(JOB_ID, usage)).resolves.toBeNull();
	});
});

describe("markFinished", () => {
	it("settles a job that has just been delivered", async () => {
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
				eq(schema.categoryJobs.id, JOB_ID),
				eq(schema.categoryJobs.status, JOB_STATUS.RUNNING),
				eq(schema.categoryJobs.state, CATEGORY_JOB_STATE.SENDING_MESSAGE),
			),
		]);
	});
});

describe("markNoArticlesSelected", () => {
	it("settles the job without recording a failure", async () => {
		const { service, update } = harness();

		await expect(service.markNoArticlesSelected(JOB_ID)).resolves.toEqual([
			{ id: JOB_ID },
		]);

		expect(update.args("set")).toEqual([
			{
				status: CATEGORY_JOB_STATUS.NO_ARTICLES_SELECTED,
				// No error text: a quiet day must not read as an incident, and the
				// `finished_at` is what the terminal-status check constraint wants.
				error: null,
				finishedAt: NOW,
			},
		]);
	});

	it("leaves the retry counter and the token totals alone", async () => {
		const { service, update } = harness();

		await service.markNoArticlesSelected(JOB_ID);

		// The selection call was billed even though it kept nothing, and the
		// retries this job did spend stay on the record.
		const [set] = update.args("set") ?? [];
		expect(set).not.toHaveProperty("retry");
		expect(set).not.toHaveProperty("promptTokens");
		expect(set).not.toHaveProperty("completionTokens");
		expect(set).not.toHaveProperty("totalTokens");
	});

	// Only the worker that still holds the job may settle it: a second one that
	// has already moved it on gets nothing back and knows to leave it be.
	it("only claims a running job still in the report state", async () => {
		const { service, update } = harness();

		await service.markNoArticlesSelected(JOB_ID);

		expect(update.args("where")).toEqual([
			and(
				eq(schema.categoryJobs.id, JOB_ID),
				eq(schema.categoryJobs.status, JOB_STATUS.RUNNING),
				eq(schema.categoryJobs.state, CATEGORY_JOB_STATE.CREATING_REPORT),
			),
		]);
	});

	it("returns nothing when the guard matches no row", async () => {
		const { service } = harness({ updated: [] });

		await expect(service.markNoArticlesSelected(JOB_ID)).resolves.toEqual([]);
	});
});

describe("markFailed", () => {
	it("fails the job and records the step it died on", async () => {
		const { service, update, insert } = harness({
			current: [{ retry: 1, state: CATEGORY_JOB_STATE.CREATING_AUDIO }],
		});

		await expect(service.markFailed(JOB_ID, "boom")).resolves.toEqual({
			id: JOB_ID,
		});

		expect(update.args("set")).toEqual([
			{ status: JOB_STATUS.FAILED, error: "boom", finishedAt: NOW },
		]);
		expect(insert.args("values")).toEqual([
			{
				categoryJobId: JOB_ID,
				attempt: 2,
				state: CATEGORY_JOB_STATE.CREATING_AUDIO,
				status: JOB_STATUS.FAILED,
				error: "boom",
			},
		]);
	});

	it("writes nothing when the job no longer exists", async () => {
		const { service, update, insert } = harness({ current: [] });

		await expect(service.markFailed(JOB_ID, "boom")).resolves.toBeNull();
		expect(update.calls).toEqual([]);
		expect(insert.calls).toEqual([]);
	});
});

describe("incrementRetry", () => {
	it("hands the job back to the queue while retries are left", async () => {
		const { service, update, insert } = harness({
			current: [{ retry: 0, state: CATEGORY_JOB_STATE.CREATING_REPORT }],
		});

		await expect(service.incrementRetry(JOB_ID, "timeout")).resolves.toEqual({
			id: JOB_ID,
		});

		// Back to `pending` with no finish date: the row is waiting, not settled.
		expect(update.args("set")).toEqual([
			{
				error: "timeout",
				retry: 1,
				status: JOB_STATUS.PENDING,
				finishedAt: null,
			},
		]);
		expect(insert.args("values")).toEqual([
			{
				categoryJobId: JOB_ID,
				attempt: 1,
				state: CATEGORY_JOB_STATE.CREATING_REPORT,
				status: JOB_STATUS.FAILED,
				error: "timeout",
			},
		]);
	});

	it("fails the job for good on the last attempt", async () => {
		const { service, update } = harness({
			current: [
				{ retry: MAX_JOB_RETRY - 1, state: CATEGORY_JOB_STATE.CREATING_AUDIO },
			],
		});

		await service.incrementRetry(JOB_ID, "timeout");

		expect(update.args("set")).toEqual([
			{
				error: "timeout",
				retry: MAX_JOB_RETRY,
				status: JOB_STATUS.FAILED,
				finishedAt: NOW,
			},
		]);
	});

	it("writes nothing when the job no longer exists", async () => {
		const { service, update, insert } = harness({ current: [] });

		await expect(service.incrementRetry(JOB_ID, "timeout")).resolves.toBeNull();
		expect(update.calls).toEqual([]);
		expect(insert.calls).toEqual([]);
	});
});
