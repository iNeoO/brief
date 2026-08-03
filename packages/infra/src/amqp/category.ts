import { z } from "zod";
import { safeParseJson } from "./json.js";

export const categoryMessageSchema = z.object({
	id: z.number(),
});

export type CategoryMessage = z.infer<typeof categoryMessageSchema>;

export const safeParseCategoryMessage = (raw: Buffer) => {
	// A malformed body is a parse failure like any other, not a thrown error the
	// consumer would have to guard separately.
	const data = safeParseJson(raw);
	return categoryMessageSchema.safeParse(data);
};
