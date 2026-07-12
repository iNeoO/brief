import { z } from "zod";

export const categoryMessageSchema = z.object({
	id: z.number(),
});

export type CategoryMessage = z.infer<typeof categoryMessageSchema>;

export const safeParseCategoryMessage = (raw: Buffer) => {
	const data = JSON.parse(raw.toString("utf-8"));
	return categoryMessageSchema.safeParse(data);
};
