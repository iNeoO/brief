import {
	CATEGORY_SEARCH_MAX_LENGTH,
	CATEGORY_SORT,
	DEFAULT_CATEGORY_SORT,
	DEFAULT_CATEGORY_SORT_ORDER,
	PAGINATION,
	SORT_ORDER,
} from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import {
	escapeLikePattern,
	normalizeListAdminCategoriesInput,
} from "./categories.helper.js";

describe("escapeLikePattern", () => {
	it("escapes the ILIKE wildcards so they match literally", () => {
		expect(escapeLikePattern("100%_off")).toBe("100\\%\\_off");
	});

	it("escapes the escape character itself", () => {
		expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
	});

	it("leaves ordinary text untouched", () => {
		expect(escapeLikePattern("Écologie & climat")).toBe("Écologie & climat");
	});
});

describe("normalizeListAdminCategoriesInput", () => {
	it("falls back to the defaults when nothing is provided", () => {
		expect(normalizeListAdminCategoriesInput({})).toEqual({
			page: PAGINATION.DEFAULT_PAGE,
			pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
			sort: DEFAULT_CATEGORY_SORT,
			order: DEFAULT_CATEGORY_SORT_ORDER,
			searchPattern: undefined,
		});
	});

	it("clamps the page size to MAX_PAGE_SIZE", () => {
		expect(
			normalizeListAdminCategoriesInput({ pageSize: 5_000 }),
		).toMatchObject({ pageSize: PAGINATION.MAX_PAGE_SIZE });
	});

	it("refuses a page size below one", () => {
		expect(normalizeListAdminCategoriesInput({ pageSize: 0 })).toMatchObject({
			pageSize: 1,
		});
	});

	it("keeps the page on the first one when it is out of range", () => {
		expect(normalizeListAdminCategoriesInput({ page: -3 })).toMatchObject({
			page: PAGINATION.DEFAULT_PAGE,
		});
	});

	it("truncates a fractional page instead of offsetting by a fraction", () => {
		expect(normalizeListAdminCategoriesInput({ page: 2.9 })).toMatchObject({
			page: 2,
		});
	});

	it("falls back on an unknown sort key", () => {
		expect(
			normalizeListAdminCategoriesInput({
				sort: "createdAt; drop table" as never,
			}),
		).toMatchObject({ sort: DEFAULT_CATEGORY_SORT });
	});

	it("keeps a known sort key and order", () => {
		expect(
			normalizeListAdminCategoriesInput({
				sort: CATEGORY_SORT.SUBSCRIBERS_COUNT,
				order: SORT_ORDER.ASC,
			}),
		).toMatchObject({
			sort: CATEGORY_SORT.SUBSCRIBERS_COUNT,
			order: SORT_ORDER.ASC,
		});
	});

	it("wraps the search term in wildcards, escaped", () => {
		expect(
			normalizeListAdminCategoriesInput({ search: "  50% tech  " }),
		).toMatchObject({ searchPattern: "%50\\% tech%" });
	});

	it("treats a blank search as no search at all", () => {
		expect(normalizeListAdminCategoriesInput({ search: "   " })).toMatchObject({
			searchPattern: undefined,
		});
	});

	it("caps the search term length", () => {
		const { searchPattern } = normalizeListAdminCategoriesInput({
			search: "a".repeat(CATEGORY_SEARCH_MAX_LENGTH + 50),
		});

		expect(searchPattern).toBe(`%${"a".repeat(CATEGORY_SEARCH_MAX_LENGTH)}%`);
	});
});
