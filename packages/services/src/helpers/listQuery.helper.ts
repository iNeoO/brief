import { PAGINATION, SORT_ORDER } from "@brief/common/constants";
import type { Paginated, SortOrder } from "@brief/common/types";

/**
 * Everything a paginated list does to its input before it reaches SQL: settle
 * the page, settle the order, turn a search term into a pattern, and wrap the
 * rows that come back. Every list here reads its parameters straight from a
 * URL, so out-of-range values are clamped and unknown ones fall back rather
 * than throwing — a reader who asks for page 0 wants the first page, not an
 * error page.
 */

/** Paging as it arrives: anything at all, or nothing. */
export type PageInput = {
	page?: number;
	pageSize?: number;
};

/** Paging settled into the three numbers a query needs. */
export type PageWindow = {
	page: number;
	pageSize: number;
	/** Rows to skip, ready for `.offset()`. */
	offset: number;
};

type PageOptions = {
	/** Page size when the caller does not pick one — or is not allowed to. */
	defaultPageSize?: number;
	maxPageSize?: number;
};

export type SortInput<TSort extends string> = {
	sort?: TSort;
	order?: SortOrder;
};

type SortOptions<TSort extends string> = {
	/** The sort keys this list accepts; anything else falls back. */
	values: readonly TSort[];
	defaultSort: TSort;
	defaultOrder: SortOrder;
};

const SORT_ORDER_VALUES: readonly SortOrder[] = Object.values(SORT_ORDER);

const toInteger = (value: number | undefined, fallback: number) =>
	typeof value === "number" && Number.isFinite(value)
		? Math.trunc(value)
		: fallback;

const clamp = (value: number, min: number, max: number) =>
	Math.min(Math.max(value, min), max);

/**
 * Settles the paging of a list. A list whose page size the reader does not
 * choose passes it as `defaultPageSize` and leaves `pageSize` out of its own
 * input type, rather than trusting the caller to pass the right one.
 */
export const normalizePage = (
	{ page, pageSize }: PageInput,
	{
		defaultPageSize = PAGINATION.DEFAULT_PAGE_SIZE,
		maxPageSize = PAGINATION.MAX_PAGE_SIZE,
	}: PageOptions = {},
): PageWindow => {
	const settledPage = Math.max(
		toInteger(page, PAGINATION.DEFAULT_PAGE),
		PAGINATION.DEFAULT_PAGE,
	);
	const settledPageSize = clamp(
		toInteger(pageSize, defaultPageSize),
		1,
		maxPageSize,
	);

	return {
		page: settledPage,
		pageSize: settledPageSize,
		offset: (settledPage - 1) * settledPageSize,
	};
};

/**
 * Settles the ordering of a list. The key is checked against the list this
 * one accepts, which is also what keeps a hand-written key out of the query:
 * callers use it to pick a SQL expression from a fixed map.
 */
export const normalizeSort = <TSort extends string>(
	{ sort, order }: SortInput<TSort>,
	{ values, defaultSort, defaultOrder }: SortOptions<TSort>,
): { sort: TSort; order: SortOrder } => ({
	sort: sort && values.includes(sort) ? sort : defaultSort,
	order: order && SORT_ORDER_VALUES.includes(order) ? order : defaultOrder,
});

/**
 * `%` and `_` are wildcards for ILIKE, and `\` escapes them. Someone typing
 * "100%" must search for that literal text, not for "100" followed by
 * anything.
 */
export const escapeLikePattern = (value: string) =>
	value.replace(/[\\%_]/g, "\\$&");

/**
 * A search term as ILIKE wants it, or undefined when there is nothing to
 * search for. The cap comes before the wildcards, so an unbounded term from
 * the URL never reaches the query whole.
 */
export const toSearchPattern = (
	search: string | undefined,
	maxLength: number,
) => {
	const trimmed = search?.trim().slice(0, maxLength);

	return trimmed ? `%${escapeLikePattern(trimmed)}%` : undefined;
};

/** Wraps one page of rows with what a pager needs to draw itself. */
export const toPage = <TItem>(
	items: TItem[],
	total: number,
	{ page, pageSize }: PageWindow,
): Paginated<TItem> => ({
	items,
	total,
	page,
	pageSize,
	// At least one page: an empty list reads as "page 1 of 1" rather than
	// leaving the pager with nothing to point at.
	pageCount: Math.max(1, Math.ceil(total / pageSize)),
});
