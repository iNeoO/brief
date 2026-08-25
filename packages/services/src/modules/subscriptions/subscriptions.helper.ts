import {
	CATEGORY_SEARCH_MAX_LENGTH,
	TOPICS_PAGE_SIZE,
} from "@brief/common/constants";
import {
	normalizePage,
	toSearchPattern,
} from "../../helpers/listQuery.helper.js";
import type {
	ListTopicsInput,
	NormalizedListTopicsInput,
} from "./subscriptions.type.js";

/**
 * Settles the paging and the search term of a topic list. The page size is
 * fixed here: unlike the admin table, the reader does not choose it.
 */
export const normalizeListTopicsInput = ({
	page,
	search,
}: Omit<ListTopicsInput, "userId">): NormalizedListTopicsInput => ({
	...normalizePage({ page }, { defaultPageSize: TOPICS_PAGE_SIZE }),
	searchPattern: toSearchPattern(search, CATEGORY_SEARCH_MAX_LENGTH),
});
