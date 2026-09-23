import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "#/libs/server/middleware";

/**
 * The admin home. Four reads rather than one: they answer different
 * questions, fail independently, and a chart can draw as soon as its own
 * series is in. None takes a parameter — the window is fixed by
 * `ADMIN_STATS_WINDOW_DAYS` — and none is refetched: the page shows what was
 * true when it opened, and a reload asks again.
 */
export const getAdminStatsOverview = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(({ context }) => context.container.adminStatsService.getOverview());

export const getAdminStatsDaily = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(({ context }) =>
		context.container.adminStatsService.getDailySeries(),
	);

export const getAdminStatsProviders = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(({ context }) =>
		context.container.adminStatsService.listProviders(),
	);

export const getAdminStatsCategories = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(({ context }) =>
		context.container.adminStatsService.listCategories(),
	);

/** Prefix, so one invalidation refreshes the whole home. */
export const ADMIN_STATS_KEY = ["admin", "stats"] as const;

// `staleTime: Infinity` is the "no refresh" rule: the data is read once per
// page load and a reload is how an admin asks for fresh figures.
const statsQuery = <TData>(name: string, queryFn: () => Promise<TData>) =>
	queryOptions({
		queryKey: [...ADMIN_STATS_KEY, name] as const,
		queryFn,
		staleTime: Number.POSITIVE_INFINITY,
	});

export const adminStatsOverviewQueryOptions = () =>
	statsQuery("overview", () => getAdminStatsOverview());

export const adminStatsDailyQueryOptions = () =>
	statsQuery("daily", () => getAdminStatsDaily());

export const adminStatsProvidersQueryOptions = () =>
	statsQuery("providers", () => getAdminStatsProviders());

export const adminStatsCategoriesQueryOptions = () =>
	statsQuery("categories", () => getAdminStatsCategories());
