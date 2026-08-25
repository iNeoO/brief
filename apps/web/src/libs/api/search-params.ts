import {
	CATEGORY_SEARCH_MAX_LENGTH,
	PAGINATION,
} from "@brief/common/constants";
import { z } from "zod";

/**
 * The list parameters every paginated route reads out of its URL. They are
 * shared so that a page number means the same thing on every page, and so
 * that raising a cap in `@brief/common` reaches all of them at once.
 *
 * Each route decides whether its parameter carries a default — the archive
 * leaves `page` out of the URL on the first page, the admin table always
 * writes it — hence the `.default()` at the call site rather than here.
 */
export const pageParam = z.coerce.number().int().min(1);

export const pageSizeParam = z.coerce
	.number()
	.int()
	.min(1)
	.max(PAGINATION.MAX_PAGE_SIZE);

/** A search box's term. The services cap it again before it reaches SQL. */
export const searchParam = z
	.string()
	.trim()
	.max(CATEGORY_SEARCH_MAX_LENGTH)
	.optional();
