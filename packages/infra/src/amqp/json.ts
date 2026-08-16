export const safeParseJson = (raw: Buffer): unknown => {
	try {
		return JSON.parse(raw.toString("utf-8"));
	} catch {
		return undefined;
	}
};
