import type { AdminStatsCategoryRow } from "@brief/services";
import { Badge, Table } from "@mantine/core";
import { useMemo } from "react";
import { formatCompact, formatInteger } from "#/libs/format/number";
import { useI18n } from "#/libs/i18n/context";
import classes from "./stats.module.css";

/**
 * Every category by audience, most followed first — the ones at the bottom
 * with briefs but no subscriber are the tokens spent for nobody.
 */
export function CategoriesTable({
	categories,
}: {
	categories: readonly AdminStatsCategoryRow[];
}) {
	const { t, locale } = useI18n();
	const labels = t.auth.admin.overview.categories;

	const rows = useMemo(
		() =>
			[...categories].sort(
				(a, b) =>
					b.subscribersCount - a.subscribersCount ||
					a.name.localeCompare(b.name, locale),
			),
		[categories, locale],
	);

	return (
		<section className={classes.tableCard} aria-label={labels.title}>
			<h2 className={classes.tableHeading}>{labels.title}</h2>
			<div className={classes.tableScroll}>
				<Table verticalSpacing="xs" highlightOnHover>
					<Table.Thead>
						<Table.Tr>
							<Table.Th>{labels.columns.name}</Table.Th>
							<Table.Th className={classes.numeric}>
								{labels.columns.subscribers}
							</Table.Th>
							<Table.Th className={classes.numeric}>
								{labels.columns.briefs}
							</Table.Th>
							<Table.Th className={classes.numeric}>
								{labels.columns.tokens}
							</Table.Th>
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{rows.map((category) => (
							<Table.Tr key={category.id}>
								<Table.Td>
									{category.name}{" "}
									{!category.isEnabled ? (
										<Badge color="gray" variant="light" size="sm">
											{labels.disabled}
										</Badge>
									) : null}
								</Table.Td>
								<Table.Td className={classes.numeric}>
									{formatInteger(category.subscribersCount, locale)}
								</Table.Td>
								<Table.Td className={classes.numeric}>
									{formatInteger(category.briefsProducedInWindow, locale)}
								</Table.Td>
								<Table.Td className={classes.numeric}>
									{formatCompact(category.tokensInWindow, locale)}
								</Table.Td>
							</Table.Tr>
						))}
					</Table.Tbody>
				</Table>
			</div>
		</section>
	);
}
