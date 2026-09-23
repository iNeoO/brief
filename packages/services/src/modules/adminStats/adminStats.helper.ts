import { COST_CURRENCY, PRICE_UNIT } from "@brief/common/constants";
import type {
	AdminStatsCost,
	AdminStatsPricing,
	AdminStatsUsage,
	DayKey,
	StatsWindow,
} from "./adminStats.type.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The UTC calendar day of an instant, the key every daily figure is filed under. */
export const toDayKey = (date: Date): DayKey => date.toISOString().slice(0, 10);

/**
 * The last `days` calendar days up to and including today, in UTC. The
 * pipeline's `target_date` is a plain date and the timestamps are read in
 * UTC, so a reader in Paris and one in Montréal see the same series.
 */
export const statsWindow = (now: Date, days: number): StatsWindow => {
	const today = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate(),
	);
	const since = new Date(today - (days - 1) * DAY_MS);

	return {
		since,
		dayKeys: Array.from({ length: days }, (_, index) =>
			toDayKey(new Date(since.getTime() + index * DAY_MS)),
		),
	};
};

/**
 * Lays the rows a grouped query returned over the window, so a day nothing
 * ran on is a row of zeros rather than a gap the chart would draw a line
 * across. A row outside the window — a job dated tomorrow — is dropped.
 */
export const fillDays = <TRow extends { day: DayKey }>(
	dayKeys: readonly DayKey[],
	rows: readonly TRow[],
	empty: (day: DayKey) => TRow,
): TRow[] => {
	const byDay = new Map(rows.map((row) => [row.day, row]));

	return dayKeys.map((day) => byDay.get(day) ?? empty(day));
};

const perMillion = (units: number, price: number) =>
	(units / PRICE_UNIT) * price;

/** Prices the window's usage against the grid, half by half. */
export const estimateCost = (
	usage: AdminStatsUsage,
	pricing: AdminStatsPricing,
): AdminStatsCost => {
	const llm = pricing.llm
		? perMillion(usage.promptTokens, pricing.llm.promptPerMillionTokens) +
			perMillion(usage.completionTokens, pricing.llm.completionPerMillionTokens)
		: null;

	const tts = pricing.tts
		? perMillion(usage.ttsCharacters, pricing.tts.perMillionCharacters)
		: null;

	return {
		llm,
		tts,
		total: llm !== null && tts !== null ? llm + tts : null,
		currency: COST_CURRENCY,
	};
};
