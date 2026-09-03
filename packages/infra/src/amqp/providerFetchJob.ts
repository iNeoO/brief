import { z } from "zod";

export const providerFetchJobMessageSchema = z.object({
	id: z.number(),
});

export type ProviderFetchJobMessage = z.infer<
	typeof providerFetchJobMessageSchema
>;

export const safeParseProviderFetchJobMessage = (raw: Buffer) => {
	const data = JSON.parse(raw.toString("utf-8"));
	return providerFetchJobMessageSchema.safeParse(data);
};
