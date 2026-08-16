export const PAGINATION = {
	DEFAULT_PAGE: 1,
	DEFAULT_PAGE_SIZE: 20,
	// A page bigger than this is refused by clamping, not by an error: the page
	// size travels in the URL, where a stale or hand-edited value is expected.
	MAX_PAGE_SIZE: 100,
	PAGE_SIZE_OPTIONS: [10, 20, 50],
} as const;

export const SORT_ORDER = {
	ASC: "asc",
	DESC: "desc",
} as const;
