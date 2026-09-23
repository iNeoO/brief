import { SORT_ORDER } from "./pagination.constant.js";

export const USER_ROLE = {
	USER: "user",
	ADMIN: "admin",
} as const;

export const DEFAULT_USER_ROLE = USER_ROLE.USER;

export const USER_NAME_MAX_LENGTH = 80;

export const ADMIN_USER_IDS_SEPARATOR = ",";

/**
 * Sortable columns of the admin user list. Lives here rather than in
 * `@brief/services` for the same reason as `CATEGORY_SORT`: the route's
 * `validateSearch` runs in the browser too.
 */
export const USER_SORT = {
	NAME: "name",
	EMAIL: "email",
	CREATED_AT: "createdAt",
	SUBSCRIPTIONS_COUNT: "subscriptionsCount",
	LAST_BRIEF_AT: "lastBriefAt",
} as const;

/** The list opens on the newest sign-ups: those are the ones being watched. */
export const DEFAULT_USER_SORT = USER_SORT.CREATED_AT;

export const DEFAULT_USER_SORT_ORDER = SORT_ORDER.DESC;

/** The list searches a name or an email, both `text` columns. */
export const USER_SEARCH_MAX_LENGTH = 100;
