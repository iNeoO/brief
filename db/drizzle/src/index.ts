import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./db/schema.js";

export {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	ilike,
	inArray,
	isNotNull,
	isNull,
	lt,
	lte,
	ne,
	not,
	or,
	sql,
} from "drizzle-orm";
export { drizzle, schema };

/**
 * The connection string is a required argument, and there is deliberately no
 * shared `db` instance here: a module-level one would open a pool for anything
 * that imports `schema` or a type, and would have to read the URL from a
 * package-wide env schema — which every importer would then have to satisfy.
 * Each app parses the variables it actually uses and passes the URL in.
 */
export const createDb = (connectionString: string) =>
	drizzle(connectionString, { relations: schema.relations });

export type Database = ReturnType<typeof createDb>;
