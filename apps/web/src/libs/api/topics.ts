import { PAGINATION } from "@brief/common/constants";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pageParam, searchParam } from "#/libs/api/search-params";
import { LOCALES, type Locale } from "#/libs/i18n/config";
import {
	authedMiddleware,
	containerMiddleware,
} from "#/libs/server/middleware";

/**
 * The topics page reads and writes one user's subscriptions, so it sits behind
 * `authedMiddleware` — including the available list, which is the catalogue
 * minus what that user already follows. The landing-page teaser is the one
 * public read here: the catalogue as anyone can see it.
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

/**
 * A category's `language` is the language its briefs are written in, and the
 * locale is the one the interface speaks. They carry the same values, and the
 * teaser matches them: naming a topic a visitor could not read is an offer we
 * do not keep. It is the locale, not the account, that decides — this runs
 * before anyone signs in.
 */
export const getShowcaseTopics = createServerFn({ method: "GET" })
	.middleware([containerMiddleware])
	.validator(z.object({ locale: z.enum(LOCALES) }))
	.handler(({ data, context }) =>
		context.container.categoriesService.listShowcase(data.locale),
	);

export const showcaseTopicsQueryOptions = (locale: Locale) =>
	queryOptions({
		// Under TOPICS_QUERY_KEY, so an admin creating a category refreshes the
		// teaser along with the two subscription lists.
		queryKey: [...TOPICS_QUERY_KEY, "showcase", locale] as const,
		queryFn: () => getShowcaseTopics({ data: { locale } }),
		// The catalogue changes when an admin adds a topic, not between two
		// readers: the teaser can be served from cache for a while.
		staleTime: 5 * 60 * 1000,
	});

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
