import { SORT_ORDER } from "./pagination.constant.js";

/**
 * Sortable columns of the admin category list. Lives here rather than in
 * `@brief/services` because the route's `validateSearch` runs in the browser
 * too, and importing the services package there would pull drizzle and
 * better-auth into the client bundle.
 */
export const CATEGORY_SORT = {
	NAME: "name",
	CREATED_AT: "createdAt",
	BRIEFS_COUNT: "briefsCount",
	SUBSCRIBERS_COUNT: "subscribersCount",
	LAST_BRIEF_AT: "lastBriefAt",
} as const;

export const DEFAULT_CATEGORY_SORT = CATEGORY_SORT.CREATED_AT;

export const DEFAULT_CATEGORY_SORT_ORDER = SORT_ORDER.DESC;

export const CATEGORY_SEARCH_MAX_LENGTH = 100;

/**
 * Page size of both lists on the topics page. The page stacks two paginated
 * sections, so a bigger page would push the available topics out of reach.
 */
export const TOPICS_PAGE_SIZE = 10;

// `name` and `description` are unbounded `text` columns; these are the limits
// the application enforces, on both sides of the form.
export const CATEGORY_NAME_MAX_LENGTH = 80;

export const CATEGORY_DESCRIPTION_MAX_LENGTH = 300;

export const CATEGORY_DESCRIPTION_CLAMP_LINES = 2;
