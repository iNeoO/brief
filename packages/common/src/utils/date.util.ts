/**
 * Formats a date as `YYYY-MM-DD`.
 *
 * Uses the `en-CA` locale, which natively renders dates in ISO-like
 * `YYYY-MM-DD` order. A time zone can be provided to avoid off-by-one-day
 * shifts around midnight (defaults to `Europe/Paris`).
 */
export function formatDateToYMD(
	date: Date,
	timeZone = "Europe/Paris",
): string {
	return new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone,
	}).format(date);
}
