import { env } from "@brief/infra/configs";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./db/schema.js";

export { and, asc, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lt, lte, ne, not, or, sql } from "drizzle-orm";
export { drizzle, schema };

export const db = drizzle(env.PG_URL, { relations: schema.relations });
export type Database = typeof db;
