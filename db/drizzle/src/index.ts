import { env } from "@brief/infra/configs";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./db/schema.js";

export { and, asc, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lt, lte, ne, not, or, sql } from "drizzle-orm";
export { drizzle, schema };

export const createDb = (connectionString: string = env.PG_URL) =>
	drizzle(connectionString, { relations: schema.relations });

export const db = createDb();
export type Database = ReturnType<typeof createDb>;
