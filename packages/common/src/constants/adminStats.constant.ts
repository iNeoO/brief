/**
 * How far back the admin home looks: the daily series, the month's totals and
 * the per-source and per-category figures all share this window, so a number
 * on a tile can be checked against the chart under it.
 */
export const ADMIN_STATS_WINDOW_DAYS = 30;

/** The prices in the cost grid are quoted per million units, as vendors do. */
export const PRICE_UNIT = 1_000_000;

export const COST_CURRENCY = "USD";
