/**
 * Decodes a message body. Returns `undefined` on invalid JSON so the caller's
 * schema rejects it like any other malformed payload, instead of throwing out
 * of the consumer and leaving the message unacknowledged.
 */
export const safeParseJson = (raw: Buffer): unknown => {
	try {
		return JSON.parse(raw.toString("utf-8"));
	} catch {
		return undefined;
	}
};
