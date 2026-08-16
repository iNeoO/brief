import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { adminMiddleware } from "#/libs/server/middleware";

export const getAdminProviders = createServerFn({ method: "GET" })
	.middleware([adminMiddleware])
	.handler(({ context }) => context.container.providersService.listAll());

export const adminProvidersQueryOptions = () =>
	queryOptions({
		queryKey: ["admin", "providers"] as const,
		queryFn: () => getAdminProviders(),
		// The provider list barely moves; no need to refetch it every time the
		// category form opens.
		staleTime: 5 * 60 * 1000,
	});
