import {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
	JOB_STATUS,
} from "@brief/common/constants";
import { type Database, schema } from "@brief/drizzle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SchedulerService } from "./scheduler.service.js";

const TARGET_DATE = new Date("2026-08-17T00:00:00.000Z");

/**
 * A stand-in for the transaction: it records what the planner writes and
 * answers its reads from `rows`, the way the database would once the inserts
 * (or the conflicts that swallowed them) have landed.
 */
const inserted: { table: unknown; rows: unknown[] }[] = [];

const rows = {
	insertedProviderFetchJobs: [] as { id: number; providerId: string }[],
	providerFetchJobs: [] as { id: number; providerId: string }[],
	insertedCategoryJobs: [] as ({ id: number } | undefined)[],
	categoryJobs: [] as { id: number }[],
};

const rowsFor = (table: unknown) =>
	table === schema.providerFetchJobs
		? rows.providerFetchJobs
		: rows.categoryJobs;

/**
 * What an insert hands back: the fetch jobs it created, and the category job
 * of the iteration in progress — `undefined` there stands for the conflict
 * that swallowed the insert.
 */
const returningFor = (table: unknown) => {
	if (table === schema.providerFetchJobs) return rows.insertedProviderFetchJobs;
	if (table !== schema.categoryJobs) return [];
	return [rows.insertedCategoryJobs.shift()].filter((row) => row !== undefined);
};

/** Awaitable on its own, like the query builder, and readable through `returning`. */
const insertResult = (table: unknown) =>
	Object.assign(Promise.resolve(), {
		returning: () => Promise.resolve(returningFor(table)),
	});

const tx = {
	insert: (table: unknown) => ({
		values: (values: unknown[]) => {
			inserted.push({ table, rows: values });
			return {
				onConflictDoNothing: () => insertResult(table),
				returning: () => Promise.resolve(returningFor(table)),
			};
		},
	}),
	select: () => ({
		from: (table: unknown) => ({
			where: () => Promise.resolve(rowsFor(table)),
		}),
	}),
};

const db = {
	transaction: (run: (t: typeof tx) => Promise<unknown>) => run(tx),
};

const insertedInto = (table: unknown) =>
	inserted.filter((write) => write.table === table).flatMap(({ rows }) => rows);

const plan = (categories: { id: string; providers: { id: string }[] }[]) =>
	new SchedulerService(db as unknown as Database).planDailyRun(
		categories,
		TARGET_DATE,
	);

beforeEach(() => {
	vi.clearAllMocks();
	inserted.length = 0;
	rows.insertedProviderFetchJobs = [];
	rows.providerFetchJobs = [];
	rows.insertedCategoryJobs = [];
	rows.categoryJobs = [];
});

describe("planDailyRun", () => {
	it("creates one fetch job per provider and one job per category", async () => {
		// Two categories, three provider slots, but only two distinct providers:
		// the shared one must be fetched once and read by both categories.
		rows.insertedProviderFetchJobs = [
			{ id: 1, providerId: "provider-1" },
			{ id: 2, providerId: "provider-2" },
		];
		rows.providerFetchJobs = rows.insertedProviderFetchJobs;
		rows.insertedCategoryJobs = [{ id: 10 }, { id: 11 }];

		const result = await plan([
			{ id: "category-1", providers: [{ id: "provider-1" }] },
			{
				id: "category-2",
				providers: [{ id: "provider-1" }, { id: "provider-2" }],
			},
		]);

		expect(insertedInto(schema.providerFetchJobs)).toEqual([
			{
				providerId: "provider-1",
				targetDate: TARGET_DATE,
				status: JOB_STATUS.PENDING,
			},
			{
				providerId: "provider-2",
				targetDate: TARGET_DATE,
				status: JOB_STATUS.PENDING,
			},
		]);
		expect(insertedInto(schema.categoryJobs)).toEqual([
			{
				categoryId: "category-1",
				targetDate: TARGET_DATE,
				status: CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS,
				state: CATEGORY_JOB_STATE.CREATING_REPORT,
			},
			{
				categoryId: "category-2",
				targetDate: TARGET_DATE,
				status: CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS,
				state: CATEGORY_JOB_STATE.CREATING_REPORT,
			},
		]);
		// The dependency snapshot: what each category job waits for today.
		expect(insertedInto(schema.categoryJobProviderFetchJobs)).toEqual([
			{ categoryJobId: 10, providerFetchJobId: 1 },
			{ categoryJobId: 11, providerFetchJobId: 1 },
			{ categoryJobId: 11, providerFetchJobId: 2 },
		]);
		// Only the fetch jobs it actually created, so the caller publishes each
		// one to the queue exactly once.
		expect(result).toEqual({
			newProviderFetchJobs: rows.insertedProviderFetchJobs,
		});
	});

	it("reuses the day's jobs when the run is planned a second time", async () => {
		// Nothing comes back from either insert: both conflicted on the unique
		// (provider, date) and (category, date) constraints.
		rows.insertedProviderFetchJobs = [];
		rows.providerFetchJobs = [{ id: 1, providerId: "provider-1" }];
		rows.insertedCategoryJobs = [undefined];
		rows.categoryJobs = [{ id: 10 }];

		const result = await plan([
			{ id: "category-1", providers: [{ id: "provider-1" }] },
		]);

		expect(result).toEqual({ newProviderFetchJobs: [] });
		expect(insertedInto(schema.categoryJobProviderFetchJobs)).toEqual([
			{ categoryJobId: 10, providerFetchJobId: 1 },
		]);
	});

	it("plans a category with no provider without touching the fetch jobs", async () => {
		rows.insertedCategoryJobs = [{ id: 10 }];

		const result = await plan([{ id: "category-1", providers: [] }]);

		expect(insertedInto(schema.providerFetchJobs)).toEqual([]);
		expect(insertedInto(schema.categoryJobs)).toHaveLength(1);
		expect(insertedInto(schema.categoryJobProviderFetchJobs)).toEqual([]);
		expect(result).toEqual({ newProviderFetchJobs: [] });
	});

	it("refuses to plan a category whose provider has no fetch job", async () => {
		// The provider row vanished between the insert and the read: linking the
		// category job to nothing would leave it waiting for ever.
		rows.insertedProviderFetchJobs = [];
		rows.providerFetchJobs = [];
		rows.insertedCategoryJobs = [{ id: 10 }];

		await expect(
			plan([{ id: "category-1", providers: [{ id: "provider-1" }] }]),
		).rejects.toMatchObject({
			code: "SCHEDULER_MISSING_PROVIDER_FETCH_JOB",
		});

		expect(insertedInto(schema.categoryJobProviderFetchJobs)).toEqual([]);
	});
});
