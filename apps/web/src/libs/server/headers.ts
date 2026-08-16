import { getRequest, setResponseHeader } from "@tanstack/react-start/server";

export const getRequestHeadersAsHeaders = () =>
	new Headers(getRequest().headers);

export const setResponseCookies = (authHeaders: Headers) => {
	const cookies = authHeaders.getSetCookie();

	if (cookies.length > 0) {
		setResponseHeader("set-cookie", cookies);
	}
};

export const mergeSetCookieHeadersIntoRequestHeaders = (
	authHeaders: Headers,
) => {
	const headers = getRequestHeadersAsHeaders();
	const issued = authHeaders
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0])
		.filter(Boolean);

	if (issued.length === 0) {
		return headers;
	}

	const existing = headers.get("cookie");
	headers.set("cookie", [...issued, existing].filter(Boolean).join("; "));

	return headers;
};
