import { PAGINATION } from "@brief/common/constants";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pageParam, searchParam } from "#/libs/api/search-params";
import { authedMiddleware } from "#/libs/server/middleware";

/**
 * The topics page reads and writes one user's subscriptions, so everything
 * here sits behind `authedMiddleware` — including the available list, which
 * is the catalogue minus what that user already follows.
 */

const topicsPageParam = pageParam.default(PAGINATION.DEFAULT_PAGE);

/**
 * Each section pages and searches on its own, so the two carry separate
 * params: filtering the available topics must not reset the subscribed list
 * halfway down the page.
 */
export const topicsSearchSchema = z.object({
	subscribedPage: topicsPageParam,
	subscribedQ: searchParam,
	availablePage: topicsPageParam,
	availableQ: searchParam,
});

export type TopicsSearch = z.output<typeof topicsSearchSchema>;

/** Prefix shared by both lists, so one invalidation refreshes them together. */
export const TOPICS_QUERY_KEY = ["topics"] as const;

const listInput = z.object({
	page: topicsPageParam,
	search: searchParam,
});

export const getSubscribedTopics = createServerFn({ method: "GET" })
	.middleware([authedMiddleware])
	.validator(listInput)
	.handler(({ data, context }) =>
		context.container.subscriptionsService.listSubscribed({
			userId: context.user.id,
			page: data.page,
			search: data.search,
		}),
	);

export const getAvailableTopics = createServerFn({ method: "GET" })
	.middleware([authedMiddleware])
	.validator(listInput)
	.handler(({ data, context }) =>
		context.container.subscriptionsService.listAvailable({
			userId: context.user.id,
			page: data.page,
			search: data.search,
		}),
	);

export const subscribedTopicsQueryOptions = (search: TopicsSearch) => {
	const input = { page: search.subscribedPage, search: search.subscribedQ };

	return queryOptions({
		// Only this section's params: a keystroke in the other search box must
		// not invalidate this list.
		queryKey: [...TOPICS_QUERY_KEY, "subscribed", input] as const,
		queryFn: () => getSubscribedTopics({ data: input }),
	});
};

export const availableTopicsQueryOptions = (search: TopicsSearch) => {
	const input = { page: search.availablePage, search: search.availableQ };

	return queryOptions({
		queryKey: [...TOPICS_QUERY_KEY, "available", input] as const,
		queryFn: () => getAvailableTopics({ data: input }),
	});
};

const subscriptionInput = z.object({ categoryId: z.uuid() });

export const subscribe = createServerFn({ method: "POST" })
	.middleware([authedMiddleware])
	.validator(subscriptionInput)
	.handler(async ({ data, context }) => {
		await context.container.subscriptionsService.subscribe({
			userId: context.user.id,
			categoryId: data.categoryId,
		});

		return { success: true };
	});

export const unsubscribe = createServerFn({ method: "POST" })
	.middleware([authedMiddleware])
	.validator(subscriptionInput)
	.handler(async ({ data, context }) => {
		await context.container.subscriptionsService.unsubscribe({
			userId: context.user.id,
			categoryId: data.categoryId,
		});

		return { success: true };
	});
