import type { Locale } from "#/libs/i18n/config";

// Same reasoning as the date formatters: an Intl.NumberFormat is the expensive
// part, and a dashboard prints dozens of figures per render.
const formatters = new Map<string, Intl.NumberFormat>();

const formatterFor = (locale: Locale, options: Intl.NumberFormatOptions) => {
	const key = `${locale}|${JSON.stringify(options)}`;
	const cached = formatters.get(key);

	if (cached) return cached;

	const formatter = new Intl.NumberFormat(locale, options);
	formatters.set(key, formatter);

	return formatter;
};

/** A count, grouped the way the locale groups thousands. */
export const formatInteger = (value: number, locale: Locale) =>
	formatterFor(locale, { maximumFractionDigits: 0 }).format(value);

/** A big figure at a glance: 1.2k, 3.4M. For tiles and axis ticks. */
export const formatCompact = (value: number, locale: Locale) =>
	formatterFor(locale, {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);

export const formatCurrency = (
	value: number,
	locale: Locale,
	currency: string,
) =>
	formatterFor(locale, {
		style: "currency",
		currency,
		maximumFractionDigits: 2,
	}).format(value);

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB"] as const;

/** Storage as an operator reads it, in decimal units like a bucket's own console. */
export const formatBytes = (bytes: number, locale: Locale) => {
	let value = Math.max(0, bytes);
	let unit = 0;

	while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
		value /= 1000;
		unit += 1;
	}

	return `${formatterFor(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(value)} ${BYTE_UNITS[unit]}`;
};
