import { Alert, Skeleton, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import classes from "#/components/admin/admin.module.css";
import { CategoriesTable } from "#/components/admin/stats/categories-table";
import {
	DailyChart,
	type DailySeries,
} from "#/components/admin/stats/daily-chart";
import { ProvidersTable } from "#/components/admin/stats/providers-table";
import { StatTiles } from "#/components/admin/stats/stat-tiles";
import statsClasses from "#/components/admin/stats/stats.module.css";
import { ROUTES } from "#/config/routes";
import {
	adminStatsCategoriesQueryOptions,
	adminStatsDailyQueryOptions,
	adminStatsOverviewQueryOptions,
	adminStatsProvidersQueryOptions,
} from "#/libs/api/admin-stats";
import { queryLoader } from "#/libs/api/query-loader";
import { useI18n } from "#/libs/i18n/context";
import type { Dictionary } from "#/libs/i18n/dictionaries";
import { localisedHead } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/admin/")({
	loader: queryLoader(
		adminStatsOverviewQueryOptions,
		adminStatsDailyQueryOptions,
		adminStatsProvidersQueryOptions,
		adminStatsCategoriesQueryOptions,
	),
	head: localisedHead((t) => ({
		title: t.auth.admin.overview.title,
		path: ROUTES.admin,
		noindex: true,
	})),
	component: AdminOverviewPage,
});

type ChartLabels = Dictionary["auth"]["admin"]["overview"]["charts"];

/**
 * What each chart plots, read off a day. Declared once per render of the
 * page, not per chart, so the series identity — and its color — is stable.
 */
const buildSeries = (labels: ChartLabels) => ({
	articles: [
		{ label: labels.articles.series, value: (day) => day.articles },
	] satisfies DailySeries[],
	briefs: [
		{ label: labels.briefs.produced, value: (day) => day.briefsProduced },
		{ label: labels.briefs.delivered, value: (day) => day.deliveriesFinished },
	] satisfies DailySeries[],
	tokens: [
		{ label: labels.tokens.prompt, value: (day) => day.promptTokens },
		{ label: labels.tokens.completion, value: (day) => day.completionTokens },
	] satisfies DailySeries[],
	failures: [
		{ label: labels.failures.fetches, value: (day) => day.fetchesFailed },
		{ label: labels.failures.briefs, value: (day) => day.briefsFailed },
		{ label: labels.failures.deliveries, value: (day) => day.deliveriesFailed },
	] satisfies DailySeries[],
});

function AdminOverviewPage() {
	const { t } = useI18n();
	const labels = t.auth.admin.overview;

	// Read once per page load — `staleTime` is infinite — so a reload is how an
	// admin asks for fresh figures.
	const overview = useQuery(adminStatsOverviewQueryOptions());
	const daily = useQuery(adminStatsDailyQueryOptions());
	const providers = useQuery(adminStatsProvidersQueryOptions());
	const categories = useQuery(adminStatsCategoriesQueryOptions());

	const series = useMemo(() => buildSeries(labels.charts), [labels.charts]);

	// The "now" the tables judge staleness against: the moment the figures
	// were read, so the page does not drift while it stays open.
	const readAt = useMemo(
		() => new Date(providers.dataUpdatedAt || Date.now()),
		[providers.dataUpdatedAt],
	);

	const failed =
		overview.isError ||
		daily.isError ||
		providers.isError ||
		categories.isError;

	return (
		<div className={classes.page}>
			<header>
				<Title order={1} size="h2" className={classes.heading}>
					{labels.title}
				</Title>
				<p className={classes.lead}>
					{labels.lead(overview.data?.windowDays ?? 30)}
				</p>
			</header>

			{failed ? (
				<Alert color="red" variant="light">
					{labels.error}
				</Alert>
			) : null}

			{overview.data ? (
				<StatTiles overview={overview.data} />
			) : (
				<Skeleton height={96} radius="md" />
			)}

			{daily.data ? (
				<div className={statsClasses.charts}>
					<DailyChart
						title={labels.charts.articles.title}
						hint={labels.charts.articles.hint}
						days={daily.data}
						series={series.articles}
					/>
					<DailyChart
						title={labels.charts.briefs.title}
						hint={labels.charts.briefs.hint}
						days={daily.data}
						series={series.briefs}
					/>
					<DailyChart
						title={labels.charts.tokens.title}
						hint={labels.charts.tokens.hint}
						days={daily.data}
						series={series.tokens}
						kind="bar"
					/>
					<DailyChart
						title={labels.charts.failures.title}
						hint={labels.charts.failures.hint}
						days={daily.data}
						series={series.failures}
						kind="bar"
					/>
				</div>
			) : (
				<Skeleton height={280} radius="md" />
			)}

			<div className={statsClasses.tables}>
				{providers.data ? (
					<ProvidersTable providers={providers.data} now={readAt} />
				) : (
					<Skeleton height={200} radius="md" />
				)}
				{categories.data ? (
					<CategoriesTable categories={categories.data} />
				) : (
					<Skeleton height={200} radius="md" />
				)}
			</div>
		</div>
	);
}
