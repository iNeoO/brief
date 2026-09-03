import {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
	JOB_STATUS,
	PAGINATION,
} from "@brief/common/constants";
import { and, desc, eq, ilike, schema } from "@brief/drizzle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDatabase, recordingChain } from "../../testing/db.fake.js";
import { AdminJobsService } from "./adminJobs.service.js";

const CATEGORY_JOB_ID = 101;
const FETCH_JOB_ID = 7;
const CATEGORY_ID = "category-1";
const PROVIDER_ID = "provider-1";
const TARGET_DATE = new Date("2026-08-17T00:00:00.000Z");
const CREATED_AT = new Date("2026-08-17T06:00:00.000Z");
const FINISHED_AT = new Date("2026-08-17T06:04:12.000Z");

/**
 * Stands in for the `deliveries` LATERAL subquery: the list selects all three
 * figures off it and can sort by the failed one.
 */
const DELIVERIES = {
	total: "deliveries.total",
	finished: "deliveries.finished",
	failed: "deliveries.failed",
};

type Rows = {
	/** The page of category jobs. */
	categoryJobs?: Record<string, unknown>[];
	/** The page of provider fetch jobs. */
	fetchJobs?: Record<string, unknown>[];
	/** The matching count, as the second query answers it. */
	total?: { total: number }[];
};

/**
 * A count selects `total` alone, which is what tells it apart from the rows
 * query on the same table — and from the three-column `deliveries` subquery.
 */
const harness = (rows: Rows = {}) => {
	const categoryJobs = recordingChain(rows.categoryJobs ?? []);
	const fetchJobs = recordingChain(rows.fetchJobs ?? []);
	const totals = recordingChain(rows.total ?? [{ total: 0 }]);
	const deliveries = recordingChain();

	Object.assign(deliveries, { as: () => DELIVERIES });

	const select = (columns: Record<string, unknown> = {}) => ({
		from: (table: unknown) => {
			const isCount = "total" in columns && Object.keys(columns).length === 1;

			if (table === schema.messageJobs) return deliveries;
			if (isCount) return totals;
			if (table === schema.providerFetchJobs) return fetchJobs;
			return categoryJobs;
		},
	});

	return {
		categoryJobs,
		fetchJobs,
		totals,
		deliveries,
		service: new AdminJobsService(asDatabase({ select })),
	};
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("listCategoryJobs", () => {
	const row = (overrides: Record<string, unknown> = {}) => ({
		id: CATEGORY_JOB_ID,
		categoryId: CATEGORY_ID,
		categoryName: "Actu France",
		targetDate: TARGET_DATE,
		status: CATEGORY_JOB_STATUS.FINISHED,
		state: CATEGORY_JOB_STATE.SENDING_MESSAGE,
		retry: 0,
		articlesCount: 6,
		totalTokens: 12_000,
		deliveriesTotal: 3,
		deliveriesFinished: 2,
		deliveriesFailed: 1,
		durationSeconds: 252,
		error: null,
		createdAt: CREATED_AT,
		finishedAt: FINISHED_AT,
		...overrides,
	});

	it("returns the page the admin table draws", async () => {
		const { service } = harness({
			categoryJobs: [row()],
			total: [{ total: 1 }],
		});

		await expect(service.listCategoryJobs()).resolves.toEqual({
			items: [
				{
					id: CATEGORY_JOB_ID,
					category: { id: CATEGORY_ID, name: "Actu France" },
					targetDate: TARGET_DATE,
					status: CATEGORY_JOB_STATUS.FINISHED,
					state: CATEGORY_JOB_STATE.SENDING_MESSAGE,
					retry: 0,
					articlesCount: 6,
					totalTokens: 12_000,
					deliveries: { total: 3, finished: 2, failed: 1 },
					durationSeconds: 252,
					error: null,
					createdAt: CREATED_AT,
					finishedAt: FINISHED_AT,
				},
			],
			total: 1,
			page: 1,
			pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
			pageCount: 1,
		});
	});

	it("reads a job with no delivery as three zeros", async () => {
		// The lateral join answers with nulls when nothing was fanned out yet, and
		// the table shows figures, not blanks.
		const { service } = harness({
			categoryJobs: [
				row({
					deliveriesTotal: null,
					deliveriesFinished: null,
					deliveriesFailed: null,
				}),
			],
		});

		await expect(service.listCategoryJobs()).resolves.toMatchObject({
			items: [{ deliveries: { total: 0, finished: 0, failed: 0 } }],
		});
	});

	it("leaves the duration blank while the run is still going", async () => {
		const { service } = harness({
			categoryJobs: [row({ durationSeconds: null, finishedAt: null })],
		});

		await expect(service.listCategoryJobs()).resolves.toMatchObject({
			items: [{ durationSeconds: null }],
		});
	});

	it("counts nothing when the count query comes back empty", async () => {
		const { service } = harness({ categoryJobs: [], total: [] });

		await expect(service.listCategoryJobs()).resolves.toMatchObject({
			total: 0,
			pageCount: 1,
		});
	});

	it("filters on the category name and the status together", async () => {
		const { service, categoryJobs, totals } = harness();

		await service.listCategoryJobs({
			search: " france ",
			status: CATEGORY_JOB_STATUS.FAILED,
		});

		const where = and(
			ilike(schema.categories.name, "%france%"),
			eq(schema.categoryJobs.status, CATEGORY_JOB_STATUS.FAILED),
		);
		expect(categoryJobs.args("where")).toEqual([where]);
		// The count has to carry the same filter, or the pager lies.
		expect(totals.args("where")).toEqual([where]);
	});

	it("searches a wildcard as the literal text it is", async () => {
		const { service, categoryJobs } = harness();

		await service.listCategoryJobs({ search: "100%" });

		expect(categoryJobs.args("where")).toEqual([
			and(ilike(schema.categories.name, "%100\\%%"), undefined),
		]);
	});

	it("widens the list when the status is not one it can show", async () => {
		// The filter arrives from a hand-editable URL: an unknown value shows
		// everything rather than throwing.
		const { service, categoryJobs } = harness();

		await service.listCategoryJobs({ status: "sideways" as never });

		expect(categoryJobs.args("where")).toEqual([and(undefined, undefined)]);
	});

	it("breaks ties on the id, newest first", async () => {
		// Two runs of the same day could otherwise swap places between two pages
		// and hide a row.
		const { service, categoryJobs } = harness();

		await service.listCategoryJobs({ sort: "deliveriesFailed", order: "asc" });

		const orderBy = categoryJobs.args("orderBy") ?? [];
		expect(orderBy).toHaveLength(2);
		expect(orderBy[1]).toEqual(desc(schema.categoryJobs.id));
	});

	it("falls back to the default sort when the key is not one it accepts", async () => {
		const rejected = harness();
		const fallback = harness();

		await rejected.service.listCategoryJobs({
			sort: "targetDate; --" as never,
		});
		await fallback.service.listCategoryJobs();

		expect(rejected.categoryJobs.args("orderBy")).toEqual(
			fallback.categoryJobs.args("orderBy"),
		);
	});

	it("walks the pages within the ceiling", async () => {
		const { service, categoryJobs } = harness({ total: [{ total: 250 }] });

		await expect(
			service.listCategoryJobs({ page: 2, pageSize: 500 }),
		).resolves.toMatchObject({
			page: 2,
			pageSize: PAGINATION.MAX_PAGE_SIZE,
			pageCount: 3,
		});

		expect(categoryJobs.args("limit")).toEqual([PAGINATION.MAX_PAGE_SIZE]);
		expect(categoryJobs.args("offset")).toEqual([PAGINATION.MAX_PAGE_SIZE]);
	});

	it("counts the deliveries of the row it is on", async () => {
		const { service, deliveries } = harness();

		await service.listCategoryJobs();

		expect(deliveries.args("where")).toEqual([
			eq(schema.messageJobs.categoryJobId, schema.categoryJobs.id),
		]);
	});
});

describe("listFetchJobs", () => {
	const row = (overrides: Record<string, unknown> = {}) => ({
		id: FETCH_JOB_ID,
		providerId: PROVIDER_ID,
		providerName: "France Info",
		targetDate: TARGET_DATE,
		status: JOB_STATUS.FINISHED,
		retry: 0,
		articlesCount: 20,
		durationSeconds: 12,
		error: null,
		createdAt: CREATED_AT,
		finishedAt: FINISHED_AT,
		...overrides,
	});

	it("returns the page the admin table draws", async () => {
		const { service } = harness({ fetchJobs: [row()], total: [{ total: 1 }] });

		await expect(service.listFetchJobs()).resolves.toEqual({
			items: [
				{
					id: FETCH_JOB_ID,
					provider: { id: PROVIDER_ID, name: "France Info" },
					targetDate: TARGET_DATE,
					status: JOB_STATUS.FINISHED,
					retry: 0,
					articlesCount: 20,
					durationSeconds: 12,
					error: null,
					createdAt: CREATED_AT,
					finishedAt: FINISHED_AT,
				},
			],
			total: 1,
			page: 1,
			pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
			pageCount: 1,
		});
	});

	it("filters on the provider name and the status together", async () => {
		const { service, fetchJobs, totals } = harness();

		await service.listFetchJobs({
			search: "info",
			status: JOB_STATUS.FAILED,
		});

		const where = and(
			ilike(schema.providers.name, "%info%"),
			eq(schema.providerFetchJobs.status, JOB_STATUS.FAILED),
		);
		expect(fetchJobs.args("where")).toEqual([where]);
		expect(totals.args("where")).toEqual([where]);
	});

	it("refuses a status that belongs to the other list", async () => {
		// `no_articles_selected` is a category job status: on this list it means
		// nothing, so the filter is dropped.
		const { service, fetchJobs } = harness();

		await service.listFetchJobs({
			status: CATEGORY_JOB_STATUS.NO_ARTICLES_SELECTED as never,
		});

		expect(fetchJobs.args("where")).toEqual([and(undefined, undefined)]);
	});

	it("counts nothing when the count query comes back empty", async () => {
		const { service } = harness({ fetchJobs: [], total: [] });

		await expect(service.listFetchJobs()).resolves.toMatchObject({
			total: 0,
			pageCount: 1,
		});
	});

	it("breaks ties on the id, newest first", async () => {
		const { service, fetchJobs } = harness();

		await service.listFetchJobs({ sort: "articlesCount" });

		const orderBy = fetchJobs.args("orderBy") ?? [];
		expect(orderBy).toHaveLength(2);
		expect(orderBy[1]).toEqual(desc(schema.providerFetchJobs.id));
	});

	it("leaves the duration blank while the fetch is still going", async () => {
		const { service } = harness({
			fetchJobs: [row({ durationSeconds: null, finishedAt: null })],
		});

		await expect(service.listFetchJobs()).resolves.toMatchObject({
			items: [{ durationSeconds: null }],
		});
	});
});
