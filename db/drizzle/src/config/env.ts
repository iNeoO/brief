import { z } from "zod";

/**
 * Read by this package's own entry points only — `drizzle.config.ts` and the
 * seed script — never by `src/index.ts`, which must stay free of any env
 * parsing so importing the schema costs nothing.
 */
const envSchema = z.object({
	PG_URL: z.string().min(1),
});

export const env = envSchema.parse(process.env);
