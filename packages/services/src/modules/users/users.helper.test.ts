import {
	DEFAULT_USER_SORT,
	DEFAULT_USER_SORT_ORDER,
	PAGINATION,
	SORT_ORDER,
	USER_SEARCH_MAX_LENGTH,
	USER_SORT,
} from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import { normalizeListAdminUsersInput } from "./users.helper.js";

/**
 * Paging, ordering and search are settled by `listQuery.helper`, which owns
 * their edge cases; what matters here is that this list wires them to its own
 * defaults, its own sort keys and its own search cap.
 */
describe("normalizeListAdminUsersInput", () => {
	it("falls back to the defaults when nothing is provided", () => {
		expect(normalizeListAdminUsersInput({})).toEqual({
			page: PAGINATION.DEFAULT_PAGE,
			pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
			offset: 0,
			sort: DEFAULT_USER_SORT,
			order: DEFAULT_USER_SORT_ORDER,
			searchPattern: undefined,
		});
	});

	it("lets the admin pick the page size, up to the ceiling", () => {
		expect(normalizeListAdminUsersInput({ pageSize: 50 })).toMatchObject({
			pageSize: 50,
		});
		expect(normalizeListAdminUsersInput({ pageSize: 5_000 })).toMatchObject({
			pageSize: PAGINATION.MAX_PAGE_SIZE,
		});
	});

	it("offsets by the page the admin asked for", () => {
		expect(
			normalizeListAdminUsersInput({ page: 3, pageSize: 10 }),
		).toMatchObject({ page: 3, offset: 20 });
	});

	it("falls back on a sort key this list does not have", () => {
		expect(
			normalizeListAdminUsersInput({ sort: "email; drop table" as never }),
		).toMatchObject({ sort: DEFAULT_USER_SORT });
	});

	it("keeps a known sort key and order", () => {
		expect(
			normalizeListAdminUsersInput({
				sort: USER_SORT.LAST_BRIEF_AT,
				order: SORT_ORDER.ASC,
			}),
		).toMatchObject({ sort: USER_SORT.LAST_BRIEF_AT, order: SORT_ORDER.ASC });
	});

	it("turns the search term into an ILIKE pattern, capped", () => {
		expect(normalizeListAdminUsersInput({ search: "  ana_@ " })).toMatchObject({
			searchPattern: "%ana\\_@%",
		});

		const { searchPattern } = normalizeListAdminUsersInput({
			search: "a".repeat(USER_SEARCH_MAX_LENGTH + 50),
		});

		expect(searchPattern).toBe(`%${"a".repeat(USER_SEARCH_MAX_LENGTH)}%`);
	});
});
