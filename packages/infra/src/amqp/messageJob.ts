import { z } from "zod";
import { safeParseJson } from "./json.js";

export const messageJobMessageSchema = z.object({
	id: z.number(),
});

export type MessageJobMessage = z.infer<typeof messageJobMessageSchema>;

export const safeParseMessageJobMessage = (raw: Buffer) => {
	const data = safeParseJson(raw);
	return messageJobMessageSchema.safeParse(data);
};
