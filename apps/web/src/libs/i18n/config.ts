export const LOCALES = ["en", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
	en: "English",
	fr: "Français",
};

export const LOCALE_COOKIE = "brief_locale";

export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const isLocale = (value: unknown): value is Locale =>
	typeof value === "string" && LOCALES.includes(value as Locale);
