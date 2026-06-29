import { z } from "zod";

export const healthSchema = z.object({
	db: z.enum(["OK", "NOT OK"]),
});
