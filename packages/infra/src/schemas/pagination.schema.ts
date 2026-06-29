import { z } from "zod";

export const paginationQueryParamsSchema = <
	TColumns extends readonly [string, ...string[]],
>(
	columns: TColumns,
) =>
	z.object({
		search: z.string().trim().min(1).optional(),
		limit: z.coerce.number().int().min(1).max(100).default(10),
		offset: z.coerce.number().int().min(0).default(0),
		sort: z.enum(columns).default(columns[0]),
		order: z.enum(["asc", "desc"] as const).default("desc"),
	});
