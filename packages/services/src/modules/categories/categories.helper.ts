import {
	CATEGORY_SEARCH_MAX_LENGTH,
	CATEGORY_SORT,
	DEFAULT_CATEGORY_SORT,
	DEFAULT_CATEGORY_SORT_ORDER,
} from "@brief/common/constants";
import type { CategorySort } from "@brief/common/types";
import {
	normalizePage,
	normalizeSort,
	toSearchPattern,
} from "../../helpers/listQuery.helper.js";
import type {
	ListAdminCategoriesInput,
	NormalizedListAdminCategoriesInput,
} from "./categories.type.js";

const CATEGORY_SORT_VALUES: readonly CategorySort[] =
	Object.values(CATEGORY_SORT);

/**
 * Settles every input of the admin category list: the paging, the column the
 * table is sorted by, and the search box. The admin picks the page size here,
 * hence the default and the ceiling of `normalizePage`.
 */
export const normalizeListAdminCategoriesInput = ({
	page,
	pageSize,
	sort,
	order,
	search,
}: ListAdminCategoriesInput): NormalizedListAdminCategoriesInput => ({
	...normalizePage({ page, pageSize }),
	...normalizeSort(
		{ sort, order },
		{
			values: CATEGORY_SORT_VALUES,
			defaultSort: DEFAULT_CATEGORY_SORT,
			defaultOrder: DEFAULT_CATEGORY_SORT_ORDER,
		},
	),
	searchPattern: toSearchPattern(search, CATEGORY_SEARCH_MAX_LENGTH),
});
