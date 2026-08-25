import type { Locale } from "#/libs/i18n/config";

type DateStyle = "medium" | "long";

// Building an Intl.DateTimeFormat is the expensive part, and a table renders
// one date per cell: keep a formatter per (locale, style, zone) instead.
const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (
	locale: Locale,
	dateStyle: DateStyle,
	timeZone?: string,
) => {
	const key = `${locale}|${dateStyle}|${timeZone ?? "local"}`;
	const cached = formatters.get(key);

	if (cached) return cached;

	const formatter = new Intl.DateTimeFormat(locale, { dateStyle, timeZone });
	formatters.set(key, formatter);

	return formatter;
};

/** An instant, read in the visitor's own time zone. */
export const formatDate = (
	date: Date,
	locale: Locale,
	dateStyle: DateStyle = "medium",
) => formatterFor(locale, dateStyle).format(date);

/**
 * A calendar day stored without a time zone — a brief's target date. Read it
 * in UTC, otherwise a reader west of Greenwich sees the day before.
 */
export const formatCalendarDate = (
	date: Date,
	locale: Locale,
	dateStyle: DateStyle = "medium",
) => formatterFor(locale, dateStyle, "UTC").format(date);
