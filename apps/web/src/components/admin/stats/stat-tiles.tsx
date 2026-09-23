import type { AdminStatsOverview } from "@brief/services";
import {
	formatBytes,
	formatCompact,
	formatCurrency,
	formatInteger,
} from "#/libs/format/number";
import type { Locale } from "#/libs/i18n/config";
import { useI18n } from "#/libs/i18n/context";
import type { Dictionary } from "#/libs/i18n/dictionaries";
import classes from "./stats.module.css";

type TileLabels = Dictionary["auth"]["admin"]["overview"]["tiles"];

/**
 * The cost tile, by how much of the price grid is filled in: both halves,
 * one of them, or none.
 */
const describeCost = (
	cost: AdminStatsOverview["cost"],
	labels: TileLabels,
	locale: Locale,
) => {
	const price = (amount: number) =>
		formatCurrency(amount, locale, cost.currency);

	if (cost.total !== null) {
		return {
			value: price(cost.total),
			hint: labels.costBreakdown(price(cost.llm ?? 0), price(cost.tts ?? 0)),
		};
	}

	if (cost.llm !== null) {
		return { value: price(cost.llm), hint: labels.costLlmOnly };
	}

	if (cost.tts !== null) {
		return { value: price(cost.tts), hint: labels.costTtsOnly };
	}

	return { value: labels.costNotConfigured, hint: labels.costHowTo };
};

function Tile({
	label,
	value,
	hint,
}: Readonly<{
	label: string;
	value: string;
	hint?: string;
}>) {
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
export function StatTiles({
	overview,
}: Readonly<{ overview: AdminStatsOverview }>) {
	const { t, locale } = useI18n();
	const labels = t.auth.admin.overview.tiles;
	const { users, window } = overview;
	const cost = describeCost(overview.cost, labels, locale);

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
			<Tile label={labels.cost} value={cost.value} hint={cost.hint} />
			<Tile
				label={labels.audioStorage}
				value={formatBytes(overview.audioStorageBytes, locale)}
				hint={labels.audioStorageHint}
			/>
		</div>
	);
}
