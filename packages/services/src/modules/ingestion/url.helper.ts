export const canonicalizeUrl = (rawUrl: string, base?: string): string => {
	let url: URL;
	try {
		url = new URL(rawUrl, base);
	} catch {
		return rawUrl.trim();
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return rawUrl.trim();
	}

	url.search = "";
	url.hash = "";

	if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
		url.pathname = url.pathname.slice(0, -1);
	}

	return url.toString();
};
