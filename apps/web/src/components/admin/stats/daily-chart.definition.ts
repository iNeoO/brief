import type { AdminStatsDay } from "@brief/services";
import { areaY, barY, defineChart, lineY } from "@tanstack/charts";
import { crosshair } from "@tanstack/charts/crosshair";
import { colorLegend, colorLegendItems } from "@tanstack/charts/legend";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import { formatCompact, formatInteger } from "#/libs/format/number";
import type { Locale } from "#/libs/i18n/config";

/**
 * The chart definition of a card of the admin home, kept apart from the
 * component: it has no React and no CSS in it, so it can be rendered to SVG
 * on its own — which is also how it is checked without a browser.
 */
/** One line or one stack of the chart, read off a day's row. */
export type DailySeries = {
	label: string;
	value: (day: AdminStatsDay) => number | null;
};

/** The long shape the marks consume: one row per day and series. */
type ChartRow = {
	day: string;
	series: string;
	value: number | null;
};

/** The chart's fixed height, plus the x-axis band it needs under the plot. */
export const CHART_HEIGHT = 240;

/** Close to the card's width in the two-column layout, so SSR barely relayouts. */
export const INITIAL_WIDTH = 520;

const dayFormatters = new Map<Locale, Intl.DateTimeFormat>();

// `YYYY-MM-DD` parses as UTC midnight; read it back in UTC so the label is
// the pipeline's day, not the day before it for a reader west of Greenwich.
const formatDay = (day: string, locale: Locale) => {
	let formatter = dayFormatters.get(locale);

	if (!formatter) {
		formatter = new Intl.DateTimeFormat(locale, {
			day: "numeric",
			month: "short",
			timeZone: "UTC",
		});
		dayFormatters.set(locale, formatter);
	}

	return formatter.format(new Date(day));
};

export const toRows = (
	days: readonly AdminStatsDay[],
	series: readonly DailySeries[],
) =>
	days.flatMap((day) =>
		series.map((entry) => ({
			day: day.day,
			series: entry.label,
			value: entry.value(day),
		})),
	);

export const buildDefinition = ({
	rows,
	series,
	kind,
	locale,
}: {
	rows: ChartRow[];
	series: readonly DailySeries[];
	kind: "line" | "bar";
	locale: Locale;
}) => {
	const labels = series.map((entry) => entry.label);
	const single = series.length === 1;

	const marks =
		kind === "bar"
			? [
					// Stacked at each day: the total is the bar, the split its segments.
					barY(rows, {
						x: "day",
						y: "value",
						color: "series",
						maxThickness: 24,
					}),
				]
			: [
					// A single trend gets a wash under its line; several stay lines only,
					// so their fills do not hide each other.
					...(single
						? [
								areaY(rows, {
									x: "day",
									y: "value",
									color: "series",
									fillOpacity: 0.1,
								}),
							]
						: []),
					lineY(rows, {
						x: "day",
						y: "value",
						color: "series",
						strokeWidth: 2,
					}),
					crosshair({ x: true, y: false }),
				];

	return defineChart({
		marks,
		scales: {
			x: {
				scale:
					kind === "bar"
						? () => scaleBand<string>().padding(0.35)
						: () => scalePoint<string>().padding(0.1),
				axis: {
					ticks: { format: (day) => formatDay(day, locale) },
					// Thirty labels do not fit in a card: keep the ends and what fits.
					tickLabels: { thin: { priority: "ends" } },
				},
			},
			y: {
				scale: scaleLinear,
				nice: true,
				grid: true,
				axis: {
					ticks: { format: (value) => formatCompact(value, locale) },
				},
			},
		},
		color: {
			// The domain is the authored series order, so a series keeps its
			// color whatever the data holds.
			domain: labels,
			// One series needs no legend box: the card's title names it.
			...(single
				? {}
				: {
						legend: colorLegend({
							placement: "top",
							items: colorLegendItems({ justify: "start", gap: 16 }),
						}),
					}),
		},
		// One tooltip, every series at that day.
		focus: "group-x",
		maxFocusDistance: Number.POSITIVE_INFINITY,
		tooltip: {
			use: tooltip,
			content: (points) => ({
				title: formatDay(String(points[0]?.xValue ?? ""), locale),
				rows: points.map((point) => ({
					label: point.groupLabel,
					value:
						typeof point.yValue === "number"
							? formatInteger(point.yValue, locale)
							: "—",
					color: point.color,
				})),
			}),
		},
	});
};
