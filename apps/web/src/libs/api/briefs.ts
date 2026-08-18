import {
	BRIEFS_PAGE_SIZE,
	LATEST_BRIEFS_LIMIT,
	PAGINATION,
} from "@brief/common/constants";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { containerMiddleware } from "#/libs/server/middleware";

/**
 * These read the published briefs, which are public: the middleware brings the
 * container in without requiring a session. Anything writing, or reading a job
 * that is not finished, stays behind `authedMiddleware`.
 */

export const briefsSearchSchema = z.object({
	page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
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
		// A brief is published once a day; refetching on every mount would only
		// re-fetch the same rows.
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

/** Where the `<audio>` element and the download link point. */
export const briefAudioUrl = (fileId: string, download = false) =>
	`/api/briefs/audio/${fileId}${download ? "?download=1" : ""}`;
