import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";

const readCookieFromDocument = (name: string) =>
	document.cookie
		.split("; ")
		.find((entry) => entry.startsWith(`${name}=`))
		?.slice(name.length + 1);

export const readStoredLocale = createIsomorphicFn()
	.server((): Locale => {
		const stored = getCookie(LOCALE_COOKIE);

		return isLocale(stored) ? stored : DEFAULT_LOCALE;
	})
	.client((): Locale => {
		const stored = readCookieFromDocument(LOCALE_COOKIE);

		return isLocale(stored) ? stored : DEFAULT_LOCALE;
	});
