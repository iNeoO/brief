import type { AdminStatsDay } from "@brief/services";
import { Chart } from "@tanstack/charts/react";
import { useMemo } from "react";
import { useI18n } from "#/libs/i18n/context";
import {
	buildDefinition,
	CHART_HEIGHT,
	type DailySeries,
	INITIAL_WIDTH,
	toRows,
} from "./daily-chart.definition";
import classes from "./stats.module.css";

export type { DailySeries } from "./daily-chart.definition";

/**
 * One card of the admin home: a title, an optional hint, and the window's
 * series as lines or stacked bars. The definition is memoised on what it
 * captures — the rows and the locale — which is the update boundary the chart
 * host works from.
 */
export function DailyChart({
	title,
	hint,
	days,
	series,
	kind = "line",
}: Readonly<{
	title: string;
	hint?: string;
	days: readonly AdminStatsDay[];
	series: readonly DailySeries[];
	kind?: "line" | "bar";
}>) {
	const { locale } = useI18n();

	const definition = useMemo(
		() =>
			buildDefinition({
				rows: toRows(days, series),
				series,
				kind,
				locale,
			}),
		[days, series, kind, locale],
	);

	return (
		<section className={classes.chartCard} aria-label={title}>
			<h2 className={classes.chartTitle}>{title}</h2>
			{hint ? <p className={classes.chartHint}>{hint}</p> : null}
			<Chart
				definition={definition}
				height={CHART_HEIGHT}
				initialWidth={INITIAL_WIDTH}
				ariaLabel={title}
			/>
		</section>
	);
}
