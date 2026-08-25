import {
	CATEGORY_DESCRIPTION_MAX_LENGTH,
	CATEGORY_NAME_MAX_LENGTH,
	CATEGORY_SORT,
	DEFAULT_CATEGORY_SORT,
	DEFAULT_CATEGORY_SORT_ORDER,
	LANGUAGE,
	PAGINATION,
	SORT_ORDER,
} from "@brief/common/constants";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	pageParam,
	pageSizeParam,
	searchParam,
} from "#/libs/api/search-params";
import { TOPICS_QUERY_KEY } from "#/libs/api/topics";
import { adminMiddleware } from "#/libs/server/middleware";

export const adminCategoriesSearchSchema = z.object({
	page: pageParam.default(PAGINATION.DEFAULT_PAGE),
	pageSize: pageSizeParam.default(PAGINATION.DEFAULT_PAGE_SIZE),
	sort: z.enum(CATEGORY_SORT).default(DEFAULT_CATEGORY_SORT),
	order: z.enum(SORT_ORDER).default(DEFAULT_CATEGORY_SORT_ORDER),
	q: searchParam,
});

export type AdminCategoriesSearch = z.output<
	typeof adminCategoriesSearchSchema
>;

export const getAdminCategories = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.validator(adminCategoriesSearchSchema)
	.handler(({ data, context }) =>
		context.container.categoriesService.listForAdmin({
			page: data.page,
			pageSize: data.pageSize,
			sort: data.sort,
			order: data.order,
			search: data.q,
		}),
	);

export const ADMIN_CATEGORIES_KEY = ["admin", "categories"] as const;

export const refreshCategories = (queryClient: QueryClient) =>
	Promise.all([
		queryClient.invalidateQueries({ queryKey: ADMIN_CATEGORIES_KEY }),
		queryClient.invalidateQueries({ queryKey: TOPICS_QUERY_KEY }),
	]);

export const adminCategoriesQueryOptions = (search: AdminCategoriesSearch) =>
	queryOptions({
		queryKey: [...ADMIN_CATEGORIES_KEY, search] as const,
		queryFn: () => getAdminCategories({ data: search }),
	});

const categoryIdInput = z.object({ id: z.uuid() });

export const categoryWriteSchema = z.object({
	name: z.string().trim().min(1).max(CATEGORY_NAME_MAX_LENGTH),
	description: z.string().trim().min(1).max(CATEGORY_DESCRIPTION_MAX_LENGTH),
	language: z.enum(LANGUAGE),
	isEnabled: z.boolean(),
	providerIds: z.array(z.uuid()),
});

export type CategoryFormValues = z.output<typeof categoryWriteSchema>;

export const getAdminCategory = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.validator(categoryIdInput)
	.handler(({ data, context }) =>
		context.container.categoriesService.getForAdmin(data.id),
	);

export const adminCategoryQueryOptions = (id: string) =>
	queryOptions({
		queryKey: ["admin", "category", id] as const,
		queryFn: () => getAdminCategory({ data: { id } }),
	});

export const createCategory = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(categoryWriteSchema)
	.handler(async ({ data, context }) => {
		const { id } = await context.container.categoriesService.create(data);

		return { id };
	});

export const updateCategory = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(categoryWriteSchema.extend({ id: z.uuid() }))
	.handler(async ({ data, context }) => {
		await context.container.categoriesService.update(data);

		return { success: true };
	});

export const setCategoryEnabled = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(categoryIdInput.extend({ isEnabled: z.boolean() }))
	.handler(async ({ data, context }) => {
		await context.container.categoriesService.setEnabled(data);

		return { success: true };
	});

export const deleteCategory = createServerFn({ method: "POST" })
	.middleware([adminMiddleware])
	.validator(categoryIdInput)
	.handler(async ({ data, context }) => {
		const orphanedFiles =
			await context.container.categoriesService.deleteForAdmin(data.id);

		await context.container.s3Service.deleteObjects(orphanedFiles);

		return { success: true };
	});
