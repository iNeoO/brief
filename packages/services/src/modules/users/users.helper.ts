import {
	DEFAULT_USER_SORT,
	DEFAULT_USER_SORT_ORDER,
	USER_SEARCH_MAX_LENGTH,
	USER_SORT,
} from "@brief/common/constants";
import type { UserSort } from "@brief/common/types";
import {
	normalizePage,
	normalizeSort,
	toSearchPattern,
} from "../../helpers/listQuery.helper.js";
import type {
	ListAdminUsersInput,
	NormalizedListAdminUsersInput,
} from "./users.type.js";

const USER_SORT_VALUES: readonly UserSort[] = Object.values(USER_SORT);

/**
 * Settles every input of the admin user list: the paging, the column the
 * table is sorted by, and the search box. The admin picks the page size here,
 * hence the default and the ceiling of `normalizePage`.
 */
export const normalizeListAdminUsersInput = ({
	page,
	pageSize,
	sort,
	order,
	search,
}: ListAdminUsersInput): NormalizedListAdminUsersInput => ({
	...normalizePage({ page, pageSize }),
	...normalizeSort(
		{ sort, order },
		{
			values: USER_SORT_VALUES,
			defaultSort: DEFAULT_USER_SORT,
			defaultOrder: DEFAULT_USER_SORT_ORDER,
		},
	),
	searchPattern: toSearchPattern(search, USER_SEARCH_MAX_LENGTH),
});
