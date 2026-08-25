import {
	CATEGORY_SEARCH_MAX_LENGTH,
	PAGINATION,
	TOPICS_PAGE_SIZE,
} from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import { normalizeListTopicsInput } from "./subscriptions.helper.js";

/**
 * Paging and search are settled by `listQuery.helper`, which owns their edge
 * cases; what matters here is that a topic list pages by its own fixed size,
 * whatever the caller asks for.
 */
describe("normalizeListTopicsInput", () => {
	it("falls back to the first page and no search when nothing is provided", () => {
		expect(normalizeListTopicsInput({})).toEqual({
			page: PAGINATION.DEFAULT_PAGE,
			pageSize: TOPICS_PAGE_SIZE,
			offset: 0,
			searchPattern: undefined,
		});
	});

	it("offsets by whole pages of its own size", () => {
		expect(normalizeListTopicsInput({ page: 3 })).toMatchObject({
			page: 3,
			pageSize: TOPICS_PAGE_SIZE,
			offset: 2 * TOPICS_PAGE_SIZE,
		});
	});

	it("turns the search term into an ILIKE pattern, capped", () => {
		expect(
			normalizeListTopicsInput({ search: "  100% climat " }),
		).toMatchObject({ searchPattern: "%100\\% climat%" });

		const { searchPattern } = normalizeListTopicsInput({
			search: "a".repeat(CATEGORY_SEARCH_MAX_LENGTH + 50),
		});

		expect(searchPattern).toBe(`%${"a".repeat(CATEGORY_SEARCH_MAX_LENGTH)}%`);
	});
});
