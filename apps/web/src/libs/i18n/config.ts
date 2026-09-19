import { DEFAULT_LOCALE, LOCALES } from "@brief/common/constants";
import type { Locale } from "@brief/common/types";

export type { Locale };
// Re-exported rather than declared here: the message-worker composes Telegram
// captions per reader and cannot import this file, so the list lives in
// `@brief/common` and both sides read the same one.
export { DEFAULT_LOCALE, LOCALES };

export const LOCALE_LABELS: Record<Locale, string> = {
	en: "English",
	fr: "Français",
};

export const LOCALE_COOKIE = "brief_locale";

export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const isLocale = (value: unknown): value is Locale =>
	typeof value === "string" && LOCALES.includes(value as Locale);
