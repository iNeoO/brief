import {
	CATEGORY_JOB_SORT,
	CATEGORY_JOB_STATUS,
	DEFAULT_CATEGORY_JOB_SORT,
	DEFAULT_FETCH_JOB_SORT,
	DEFAULT_JOB_SORT_ORDER,
	FETCH_JOB_SORT,
	JOB_SEARCH_MAX_LENGTH,
	JOB_STATUS,
	PAGINATION,
	SORT_ORDER,
} from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import {
	normalizeListAdminCategoryJobsInput,
	normalizeListAdminFetchJobsInput,
} from "./adminJobs.helper.js";

/**
 * Paging, ordering and search are settled by `listQuery.helper`, which owns
 * their edge cases; what matters here is that each list wires them to its own
 * defaults, its own sort keys and its own statuses — the two lists accept
 * different ones, and a tab switch carries the other tab's parameters along.
 */
describe("normalizeListAdminCategoryJobsInput", () => {
	it("falls back to the defaults when nothing is provided", () => {
		expect(normalizeListAdminCategoryJobsInput({})).toEqual({
			page: PAGINATION.DEFAULT_PAGE,
			pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
			offset: 0,
			sort: DEFAULT_CATEGORY_JOB_SORT,
			order: DEFAULT_JOB_SORT_ORDER,
			searchPattern: undefined,
			status: undefined,
		});
	});

	it("keeps the first page when the page is out of range", () => {
		expect(normalizeListAdminCategoryJobsInput({ page: 0 })).toMatchObject({
			page: PAGINATION.DEFAULT_PAGE,
			offset: 0,
		});
	});

	it("lets the admin pick the page size, up to the ceiling", () => {
		expect(
			normalizeListAdminCategoryJobsInput({ pageSize: 5_000 }),
		).toMatchObject({ pageSize: PAGINATION.MAX_PAGE_SIZE });
	});

	it("falls back on a sort key this list does not have", () => {
		expect(
			normalizeListAdminCategoryJobsInput({
				// The fetch list's key, carried over by a tab switch.
				sort: FETCH_JOB_SORT.PROVIDER as never,
			}),
		).toMatchObject({ sort: DEFAULT_CATEGORY_JOB_SORT });
	});

	it("keeps a known sort key and order", () => {
		expect(
			normalizeListAdminCategoryJobsInput({
				sort: CATEGORY_JOB_SORT.TOTAL_TOKENS,
				order: SORT_ORDER.ASC,
			}),
		).toMatchObject({
			sort: CATEGORY_JOB_SORT.TOTAL_TOKENS,
			order: SORT_ORDER.ASC,
		});
	});

	it("keeps a status of its own enum", () => {
		expect(
			normalizeListAdminCategoryJobsInput({
				status: CATEGORY_JOB_STATUS.NO_ARTICLES_SELECTED,
			}),
		).toMatchObject({ status: CATEGORY_JOB_STATUS.NO_ARTICLES_SELECTED });
	});

	it("drops a status that is not a status at all", () => {
		expect(
			normalizeListAdminCategoryJobsInput({ status: "'; drop table" as never }),
		).toMatchObject({ status: undefined });
	});

	it("turns the search term into an ILIKE pattern, capped", () => {
		expect(
			normalizeListAdminCategoryJobsInput({ search: "  50% tech  " }),
		).toMatchObject({ searchPattern: "%50\\% tech%" });

		const { searchPattern } = normalizeListAdminCategoryJobsInput({
			search: "a".repeat(JOB_SEARCH_MAX_LENGTH + 50),
		});

		expect(searchPattern).toBe(`%${"a".repeat(JOB_SEARCH_MAX_LENGTH)}%`);
	});
});

describe("normalizeListAdminFetchJobsInput", () => {
	it("falls back to the defaults when nothing is provided", () => {
		expect(normalizeListAdminFetchJobsInput({})).toEqual({
			page: PAGINATION.DEFAULT_PAGE,
			pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
			offset: 0,
			sort: DEFAULT_FETCH_JOB_SORT,
			order: DEFAULT_JOB_SORT_ORDER,
			searchPattern: undefined,
			status: undefined,
		});
	});

	it("falls back on a sort key only the category list has", () => {
		expect(
			normalizeListAdminFetchJobsInput({
				sort: CATEGORY_JOB_SORT.TOTAL_TOKENS as never,
			}),
		).toMatchObject({ sort: DEFAULT_FETCH_JOB_SORT });
	});

	it("keeps a known sort key", () => {
		expect(
			normalizeListAdminFetchJobsInput({
				sort: FETCH_JOB_SORT.ARTICLES_COUNT,
			}),
		).toMatchObject({ sort: FETCH_JOB_SORT.ARTICLES_COUNT });
	});

	it("keeps a plain job status", () => {
		expect(
			normalizeListAdminFetchJobsInput({ status: JOB_STATUS.FAILED }),
		).toMatchObject({ status: JOB_STATUS.FAILED });
	});

	it("drops a status a fetch job can never have", () => {
		expect(
			normalizeListAdminFetchJobsInput({
				// Only a category job waits for its providers.
				status: CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS as never,
			}),
		).toMatchObject({ status: undefined });
	});
});
