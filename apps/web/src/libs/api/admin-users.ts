import {
	DEFAULT_USER_SORT,
	DEFAULT_USER_SORT_ORDER,
	PAGINATION,
	SORT_ORDER,
	USER_SORT,
} from "@brief/common/constants";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	pageParam,
	pageSizeParam,
	searchParam,
} from "#/libs/api/search-params";
import { adminMiddleware } from "#/libs/server/middleware";

export const adminUsersSearchSchema = z.object({
	page: pageParam.default(PAGINATION.DEFAULT_PAGE),
	pageSize: pageSizeParam.default(PAGINATION.DEFAULT_PAGE_SIZE),
	sort: z.enum(USER_SORT).default(DEFAULT_USER_SORT),
	order: z.enum(SORT_ORDER).default(DEFAULT_USER_SORT_ORDER),
	q: searchParam,
});

export type AdminUsersSearch = z.output<typeof adminUsersSearchSchema>;

export const getAdminUsers = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.validator(adminUsersSearchSchema)
	.handler(({ data, context }) =>
		context.container.usersService.listForAdmin({
			page: data.page,
			pageSize: data.pageSize,
			sort: data.sort,
			order: data.order,
			search: data.q,
		}),
	);

/** Prefix, so one invalidation refreshes every page of the list. */
export const ADMIN_USERS_KEY = ["admin", "users"] as const;

export const adminUsersQueryOptions = (search: AdminUsersSearch) =>
	queryOptions({
		queryKey: [...ADMIN_USERS_KEY, search] as const,
		queryFn: () => getAdminUsers({ data: search }),
	});
