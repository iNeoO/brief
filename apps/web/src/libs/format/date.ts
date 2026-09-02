import type { Locale } from "#/libs/i18n/config";

type DateStyle = "medium" | "long";

// Building an Intl.DateTimeFormat is the expensive part, and a table renders
// one date per cell: keep a formatter per (locale, style, zone) instead.
const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (locale: Locale, options: Intl.DateTimeFormatOptions) => {
	const key = `${locale}|${options.dateStyle}|${options.timeStyle}|${options.timeZone ?? "local"}`;
	const cached = formatters.get(key);

	if (cached) return cached;

	const formatter = new Intl.DateTimeFormat(locale, options);
	formatters.set(key, formatter);

	return formatter;
};

/** An instant, read in the visitor's own time zone. */
export const formatDate = (
	date: Date,
	locale: Locale,
	dateStyle: DateStyle = "medium",
) => formatterFor(locale, { dateStyle }).format(date);

/**
 * An instant down to the minute. A job list is read against what happened that
 * morning, so the hour is the point — and two runs of the same day are told
 * apart by nothing else.
 */
export const formatDateTime = (date: Date, locale: Locale) =>
	formatterFor(locale, { dateStyle: "short", timeStyle: "short" }).format(date);

/**
 * A calendar day stored without a time zone — a brief's target date. Read it
 * in UTC, otherwise a reader west of Greenwich sees the day before.
 */
export const formatCalendarDate = (
	date: Date,
	locale: Locale,
	dateStyle: DateStyle = "medium",
) => formatterFor(locale, { dateStyle, timeZone: "UTC" }).format(date);
