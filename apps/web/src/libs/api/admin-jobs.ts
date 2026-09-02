import {
	CATEGORY_JOB_SORT,
	CATEGORY_JOB_STATUS,
	DEFAULT_CATEGORY_JOB_SORT,
	DEFAULT_FETCH_JOB_SORT,
	DEFAULT_JOB_SORT_ORDER,
	FETCH_JOB_SORT,
	JOB_STATUS,
	PAGINATION,
	SORT_ORDER,
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

/**
 * The two job lists page, sort and search the same way and differ only in what
 * they can be sorted by and filtered on — each tab is its own route, so each
 * gets its own schema rather than one union keyed by a tab parameter.
 */
const jobsListParams = {
	page: pageParam.default(PAGINATION.DEFAULT_PAGE),
	pageSize: pageSizeParam.default(PAGINATION.DEFAULT_PAGE_SIZE),
	order: z.enum(SORT_ORDER).default(DEFAULT_JOB_SORT_ORDER),
	q: searchParam,
};

export const adminCategoryJobsSearchSchema = z.object({
	...jobsListParams,
	sort: z.enum(CATEGORY_JOB_SORT).default(DEFAULT_CATEGORY_JOB_SORT),
	status: z.enum(CATEGORY_JOB_STATUS).optional(),
});

export const adminFetchJobsSearchSchema = z.object({
	...jobsListParams,
	sort: z.enum(FETCH_JOB_SORT).default(DEFAULT_FETCH_JOB_SORT),
	status: z.enum(JOB_STATUS).optional(),
});

export type AdminCategoryJobsSearch = z.output<
	typeof adminCategoryJobsSearchSchema
>;

export type AdminFetchJobsSearch = z.output<typeof adminFetchJobsSearchSchema>;

export const getAdminCategoryJobs = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.validator(adminCategoryJobsSearchSchema)
	.handler(({ data, context }) =>
		context.container.adminJobsService.listCategoryJobs({
			page: data.page,
			pageSize: data.pageSize,
			sort: data.sort,
			order: data.order,
			search: data.q,
			status: data.status,
		}),
	);

export const getAdminFetchJobs = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.validator(adminFetchJobsSearchSchema)
	.handler(({ data, context }) =>
		context.container.adminJobsService.listFetchJobs({
			page: data.page,
			pageSize: data.pageSize,
			sort: data.sort,
			order: data.order,
			search: data.q,
			status: data.status,
		}),
	);

/** Prefix shared by both lists, so one invalidation refreshes the section. */
export const ADMIN_JOBS_KEY = ["admin", "jobs"] as const;

export const adminCategoryJobsQueryOptions = (
	search: AdminCategoryJobsSearch,
) =>
	queryOptions({
		queryKey: [...ADMIN_JOBS_KEY, "category", search] as const,
		queryFn: () => getAdminCategoryJobs({ data: search }),
	});

export const adminFetchJobsQueryOptions = (search: AdminFetchJobsSearch) =>
	queryOptions({
		queryKey: [...ADMIN_JOBS_KEY, "fetch", search] as const,
		queryFn: () => getAdminFetchJobs({ data: search }),
	});
