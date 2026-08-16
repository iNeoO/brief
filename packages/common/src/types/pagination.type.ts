import type { SORT_ORDER } from "../constants/pagination.constant.js";

export type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER];

export type Paginated<TItem> = {
	items: TItem[];
	total: number;
	page: number;
	pageSize: number;
	pageCount: number;
};
