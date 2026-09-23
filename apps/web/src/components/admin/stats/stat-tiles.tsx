import type { AdminStatsOverview } from "@brief/services";
import {
	formatBytes,
	formatCompact,
	formatCurrency,
	formatInteger,
} from "#/libs/format/number";
import { useI18n } from "#/libs/i18n/context";
import classes from "./stats.module.css";

function Tile({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<div className={classes.tile}>
			<p className={classes.tileLabel}>{label}</p>
			<p className={classes.tileValue}>{value}</p>
			{hint ? <p className={classes.tileHint}>{hint}</p> : null}
		</div>
	);
}

/**
 * The KPI row: the headline numbers, each one a figure rather than a chart.
 * The window figures share their window with the charts below, so a tile can
 * be checked against the series under it.
 */
export function StatTiles({ overview }: { overview: AdminStatsOverview }) {
	const { t, locale } = useI18n();
	const labels = t.auth.admin.overview.tiles;
	const { users, window, cost } = overview;

	const costValue =
		cost.total !== null
			? formatCurrency(cost.total, locale, cost.currency)
			: cost.llm !== null
				? formatCurrency(cost.llm, locale, cost.currency)
				: cost.tts !== null
					? formatCurrency(cost.tts, locale, cost.currency)
					: labels.costNotConfigured;

	const costHint =
		cost.total !== null
			? labels.costBreakdown(
					formatCurrency(cost.llm ?? 0, locale, cost.currency),
					formatCurrency(cost.tts ?? 0, locale, cost.currency),
				)
			: cost.llm !== null
				? labels.costLlmOnly
				: cost.tts !== null
					? labels.costTtsOnly
					: labels.costHowTo;

	return (
		<div className={classes.tiles}>
			<Tile
				label={labels.users}
				value={formatInteger(users.total, locale)}
				hint={labels.newUsers(users.newInWindow)}
			/>
			<Tile
				label={labels.telegramPaired}
				value={formatInteger(users.telegramPaired, locale)}
				hint={labels.subscribed(users.subscribed)}
			/>
			<Tile
				label={labels.briefsProduced}
				value={formatInteger(window.briefsProduced, locale)}
				hint={labels.deliveries(window.deliveriesFinished)}
			/>
			<Tile
				label={labels.tokens}
				value={formatCompact(
					window.promptTokens + window.completionTokens,
					locale,
				)}
				hint={labels.tokensBreakdown(
					formatCompact(window.promptTokens, locale),
					formatCompact(window.completionTokens, locale),
				)}
			/>
			<Tile label={labels.cost} value={costValue} hint={costHint} />
			<Tile
				label={labels.audioStorage}
				value={formatBytes(overview.audioStorageBytes, locale)}
				hint={labels.audioStorageHint}
			/>
		</div>
	);
}
