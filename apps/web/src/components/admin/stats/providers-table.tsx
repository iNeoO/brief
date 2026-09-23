import type { AdminStatsProviderRow } from "@brief/services";
import { Badge, Table } from "@mantine/core";
import { useMemo } from "react";
import { NoValue } from "#/components/admin/job-cells";
import { formatDate } from "#/libs/format/date";
import { formatInteger } from "#/libs/format/number";
import { useI18n } from "#/libs/i18n/context";
import classes from "./stats.module.css";

/**
 * A source is listed as quiet once nothing has come in for this long. Well
 * past a weekend or a bank holiday, well short of "we forgot about it".
 */
const QUIET_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every source, the ones to worry about first: never produced, then longest
 * silent, then the rest by what they brought in.
 */
export function ProvidersTable({
	providers,
	now,
}: {
	providers: readonly AdminStatsProviderRow[];
	now: Date;
}) {
	const { t, locale } = useI18n();
	const labels = t.auth.admin.overview.providers;

	const rows = useMemo(
		() =>
			[...providers].sort(
				(a, b) =>
					(a.lastArticleAt?.getTime() ?? 0) - (b.lastArticleAt?.getTime() ?? 0),
			),
		[providers],
	);

	const quietBefore = now.getTime() - QUIET_AFTER_DAYS * DAY_MS;

	return (
		<section className={classes.tableCard} aria-label={labels.title}>
			<h2 className={classes.tableHeading}>{labels.title}</h2>
			<div className={classes.tableScroll}>
				<Table verticalSpacing="xs" highlightOnHover>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>{labels.columns.name}</Table.Th>
							<Table.Th>{labels.columns.state}</Table.Th>
							<Table.Th className={classes.numeric}>
								{labels.columns.articles}
							</Table.Th>
							<Table.Th>{labels.columns.lastArticle}</Table.Th>
							<Table.Th className={classes.numeric}>
								{labels.columns.failedFetches}
							</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{rows.map((provider) => {
							const isQuiet =
								provider.isEnabled &&
								(provider.lastArticleAt?.getTime() ?? 0) < quietBefore;

							return (
								<Table.Tr key={provider.id}>
									<Table.Td>{provider.name}</Table.Td>
									<Table.Td>
										{!provider.isEnabled ? (
											<Badge color="gray" variant="light" size="sm">
												{labels.state.disabled}
											</Badge>
										) : isQuiet ? (
											<Badge color="red" variant="light" size="sm">
												{labels.state.quiet}
											</Badge>
										) : (
											<Badge color="teal" variant="light" size="sm">
												{labels.state.active}
											</Badge>
										)}
									</Table.Td>
									<Table.Td className={classes.numeric}>
										{formatInteger(provider.articlesInWindow, locale)}
									</Table.Td>
									<Table.Td>
										{provider.lastArticleAt ? (
											formatDate(provider.lastArticleAt, locale)
										) : (
											<NoValue />
										)}
									</Table.Td>
									<Table.Td className={classes.numeric}>
										{formatInteger(provider.fetchesFailedInWindow, locale)}
									</Table.Td>
								</Table.Tr>
							);
						})}
					</Table.Tbody>
				</Table>
			</div>
		</section>
	);
}
