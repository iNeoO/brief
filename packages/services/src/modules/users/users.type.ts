import type { SortOrder, UserSort } from "@brief/common/types";
import type { PageWindow } from "../../helpers/listQuery.helper.js";

export type ListAdminUsersInput = {
	page?: number;
	pageSize?: number;
	sort?: UserSort;
	order?: SortOrder;
	search?: string;
};

/** Same shape after normalisation, with every value settled. */
export type NormalizedListAdminUsersInput = PageWindow & {
	sort: UserSort;
	order: SortOrder;
	/** Ready-to-use ILIKE pattern, or undefined when no search is active. */
	searchPattern: string | undefined;
};

export type AdminUserRow = {
	id: string;
	name: string;
	email: string;
	createdAt: Date;
	/** How many topics the reader follows. */
	subscriptionsCount: number;
	/**
	 * When the last brief reached the reader on Telegram. Null for a reader who
	 * has never been delivered one — unpaired, or paired after the last run.
	 */
	lastBriefAt: Date | null;
};
