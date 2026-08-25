import {
	CATEGORY_SEARCH_MAX_LENGTH,
	CATEGORY_SORT,
	DEFAULT_CATEGORY_SORT,
	DEFAULT_CATEGORY_SORT_ORDER,
	PAGINATION,
	SORT_ORDER,
} from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import { normalizeListAdminCategoriesInput } from "./categories.helper.js";

/**
 * Paging, ordering and search are settled by `listQuery.helper`, which owns
 * their edge cases; what matters here is that this list wires them to its own
 * defaults, its own sort keys and its own search cap.
 */
describe("normalizeListAdminCategoriesInput", () => {
	it("falls back to the defaults when nothing is provided", () => {
		expect(normalizeListAdminCategoriesInput({})).toEqual({
			page: PAGINATION.DEFAULT_PAGE,
			pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
			offset: 0,
			sort: DEFAULT_CATEGORY_SORT,
			order: DEFAULT_CATEGORY_SORT_ORDER,
			searchPattern: undefined,
		});
	});

	it("lets the admin pick the page size, up to the ceiling", () => {
		expect(normalizeListAdminCategoriesInput({ pageSize: 50 })).toMatchObject({
			pageSize: 50,
		});
		expect(
			normalizeListAdminCategoriesInput({ pageSize: 5_000 }),
		).toMatchObject({ pageSize: PAGINATION.MAX_PAGE_SIZE });
	});

	it("offsets by the page the admin asked for", () => {
		expect(
			normalizeListAdminCategoriesInput({ page: 3, pageSize: 10 }),
		).toMatchObject({ page: 3, offset: 20 });
	});

	it("falls back on a sort key this list does not have", () => {
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

	it("turns the search term into an ILIKE pattern, capped", () => {
		expect(
			normalizeListAdminCategoriesInput({ search: "  50% tech  " }),
		).toMatchObject({ searchPattern: "%50\\% tech%" });

		const { searchPattern } = normalizeListAdminCategoriesInput({
			search: "a".repeat(CATEGORY_SEARCH_MAX_LENGTH + 50),
		});

		expect(searchPattern).toBe(`%${"a".repeat(CATEGORY_SEARCH_MAX_LENGTH)}%`);
	});
});
