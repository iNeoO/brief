import {
	CATEGORY_SEARCH_MAX_LENGTH,
	PAGINATION,
	TOPICS_PAGE_SIZE,
} from "@brief/common/constants";
import { escapeLikePattern } from "../categories/categories.helper.js";
import type {
	ListTopicsInput,
	NormalizedListTopicsInput,
} from "./subscriptions.type.js";

/**
 * Settles the paging and the search term of a topic list. Both reach the
 * service straight from the URL, so an out-of-range page is clamped and an
 * unusable search falls back to none, rather than throwing. The page size is
 * fixed here: unlike the admin table, the reader does not choose it.
 */
export const normalizeListTopicsInput = ({
	page,
	search,
}: Omit<ListTopicsInput, "userId">): NormalizedListTopicsInput => {
	const trimmedSearch = search?.trim().slice(0, CATEGORY_SEARCH_MAX_LENGTH);

	return {
		page:
			typeof page === "number" && Number.isFinite(page)
				? Math.max(Math.trunc(page), PAGINATION.DEFAULT_PAGE)
				: PAGINATION.DEFAULT_PAGE,
		pageSize: TOPICS_PAGE_SIZE,
		searchPattern: trimmedSearch
			? `%${escapeLikePattern(trimmedSearch)}%`
			: undefined,
	};
};
