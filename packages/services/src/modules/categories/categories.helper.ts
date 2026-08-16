import {
	CATEGORY_SEARCH_MAX_LENGTH,
	CATEGORY_SORT,
	DEFAULT_CATEGORY_SORT,
	DEFAULT_CATEGORY_SORT_ORDER,
	PAGINATION,
	SORT_ORDER,
} from "@brief/common/constants";
import type { CategorySort, SortOrder } from "@brief/common/types";
import type {
	ListAdminCategoriesInput,
	NormalizedListAdminCategoriesInput,
} from "./categories.type.js";

const CATEGORY_SORT_VALUES: readonly CategorySort[] =
	Object.values(CATEGORY_SORT);

const SORT_ORDER_VALUES: readonly SortOrder[] = Object.values(SORT_ORDER);

/**
 * `%` and `_` are wildcards for ILIKE, and `\` escapes them. An admin typing
 * "100%" must search for that literal text, not for "100" followed by
 * anything.
 */
export const escapeLikePattern = (value: string) =>
	value.replace(/[\\%_]/g, "\\$&");

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

const toPositiveInteger = (value: number | undefined, fallback: number) =>
	typeof value === "number" && Number.isFinite(value)
		? Math.trunc(value)
		: fallback;

/**
 * Settles every input of the admin category list. Out-of-range values are
 * clamped and unknown ones fall back rather than throwing: these values reach
 * the service straight from the URL.
 */
export const normalizeListAdminCategoriesInput = ({
	page,
	pageSize,
	sort,
	order,
	search,
}: ListAdminCategoriesInput): NormalizedListAdminCategoriesInput => {
	const trimmedSearch = search?.trim().slice(0, CATEGORY_SEARCH_MAX_LENGTH);

	return {
		page: Math.max(
			toPositiveInteger(page, PAGINATION.DEFAULT_PAGE),
			PAGINATION.DEFAULT_PAGE,
		),
		pageSize: clamp(
			toPositiveInteger(pageSize, PAGINATION.DEFAULT_PAGE_SIZE),
			1,
			PAGINATION.MAX_PAGE_SIZE,
		),
		sort:
			sort && CATEGORY_SORT_VALUES.includes(sort)
				? sort
				: DEFAULT_CATEGORY_SORT,
		order:
			order && SORT_ORDER_VALUES.includes(order)
				? order
				: DEFAULT_CATEGORY_SORT_ORDER,
		searchPattern: trimmedSearch
			? `%${escapeLikePattern(trimmedSearch)}%`
			: undefined,
	};
};
