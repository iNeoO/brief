import type { z } from "zod";
import type { paginationQueryParamsSchema } from "../schemas/pagination.schema.js";

export type Pagination<TColumns extends readonly [string, ...string[]]> =
	z.infer<ReturnType<typeof paginationQueryParamsSchema<TColumns>>>;
