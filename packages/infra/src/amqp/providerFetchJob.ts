import { z } from "zod";
import { safeParseJson } from "./json.js";

export const providerFetchJobMessageSchema = z.object({
	id: z.number(),
});

export type ProviderFetchJobMessage = z.infer<
	typeof providerFetchJobMessageSchema
>;

export const safeParseProviderFetchJobMessage = (raw: Buffer) => {
	const data = safeParseJson(raw);
	return providerFetchJobMessageSchema.safeParse(data);
};
