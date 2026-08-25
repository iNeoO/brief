import { BRIEFS_PAGE_SIZE, LATEST_BRIEFS_LIMIT } from "@brief/common/constants";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { pageParam } from "#/libs/api/search-params";
import {
	authedMiddleware,
	containerMiddleware,
} from "#/libs/server/middleware";

export const briefsSearchSchema = z.object({
	// No default: the first page leaves the parameter out of the URL, so the
	// archive keeps a single canonical address.
	page: pageParam.optional(),
});

export type BriefsSearch = z.output<typeof briefsSearchSchema>;

export const getLatestBriefs = createServerFn({ method: "GET" })
	.middleware([containerMiddleware])
	.handler(({ context }) =>
		context.container.briefsService.listLatest(LATEST_BRIEFS_LIMIT),
	);

export const latestBriefsQueryOptions = () =>
	queryOptions({
		queryKey: ["briefs", "latest"] as const,
		queryFn: () => getLatestBriefs(),
		staleTime: 5 * 60 * 1000,
	});

export const getBriefs = createServerFn({ method: "GET" })
	.middleware([containerMiddleware])
	.validator(briefsSearchSchema)
	.handler(({ data, context }) =>
		context.container.briefsService.list({
			page: data.page,
			pageSize: BRIEFS_PAGE_SIZE,
		}),
	);

export const briefsQueryOptions = (search: BriefsSearch) =>
	queryOptions({
		queryKey: ["briefs", "list", search] as const,
		queryFn: () => getBriefs({ data: search }),
		staleTime: 5 * 60 * 1000,
	});

export const getSubscribedBriefs = createServerFn({ method: "GET" })
	.middleware([authedMiddleware])
	.validator(briefsSearchSchema)
	.handler(({ data, context }) =>
		context.container.briefsService.listSubscribed({
			userId: context.user.id,
			page: data.page,
			pageSize: BRIEFS_PAGE_SIZE,
		}),
	);

export const subscribedBriefsQueryOptions = (search: BriefsSearch) =>
	queryOptions({
		queryKey: ["briefs", "subscribed", search] as const,
		queryFn: () => getSubscribedBriefs({ data: search }),
	});

export const getBrief = createServerFn({ method: "GET" })
	.middleware([containerMiddleware])
	.validator(z.object({ id: z.coerce.number().int().positive() }))
	.handler(({ data, context }) =>
		context.container.briefsService.getById(data.id),
	);

export const briefQueryOptions = (id: number) =>
	queryOptions({
		queryKey: ["briefs", "detail", id] as const,
		queryFn: () => getBrief({ data: { id } }),
	});

export const briefAudioUrl = (fileId: string, download = false) =>
	`/api/briefs/audio/${fileId}${download ? "?download=1" : ""}`;
