import { CATEGORY_SORT } from "@brief/common/constants";
import type { CategorySort, Paginated } from "@brief/common/types";
import type { AdminCategoryRow } from "@brief/services";
import {
	ActionIcon,
	Badge,
	Button,
	Group,
	Menu,
	Text,
	Tooltip,
} from "@mantine/core";
import { useMemo } from "react";
import { DotsIcon, PlusIcon } from "#/components/icons";
import type { AdminCategoriesSearch } from "#/libs/api/admin-categories";
import { formatCalendarDate, formatDate } from "#/libs/format/date";
import type { Locale } from "#/libs/i18n/config";
import { useI18n } from "#/libs/i18n/context";
import type { Dictionary } from "#/libs/i18n/dictionaries";
import classes from "./admin.module.css";
import {
	AdminTable,
	type AdminTableColumns,
	createAdminColumnHelper,
} from "./admin-table";

const columnHelper = createAdminColumnHelper<AdminCategoryRow>();

const CATEGORY_SORT_KEYS: readonly CategorySort[] =
	Object.values(CATEGORY_SORT);

const NUMERIC_COLUMN_IDS: readonly string[] = [
	CATEGORY_SORT.BRIEFS_COUNT,
	CATEGORY_SORT.SUBSCRIBERS_COUNT,
];

const buildColumns = (
	t: Dictionary,
	locale: Locale,
	rowActions: RowActions,
): AdminTableColumns<AdminCategoryRow> => {
	const labels = t.auth.admin.categories;

	return columnHelper.columns([
		columnHelper.accessor("name", {
			id: CATEGORY_SORT.NAME,
			header: labels.columns.name,
			cell: (info) => <Text fw={500}>{info.getValue()}</Text>,
		}),
		columnHelper.accessor("description", {
			id: "description",
			header: labels.columns.description,
			enableSorting: false,
			cell: (info) => {
				const description = info.getValue();

				// Clamped in CSS rather than cut server-side, so the full text stays
				// available to the tooltip and to a text search in the browser.
				return (
					<Tooltip
						label={description}
						multiline
						w={320}
						withArrow
						openDelay={400}
					>
						<Text component="span" size="sm" className={classes.description}>
							{description}
						</Text>
					</Tooltip>
				);
			},
		}),
		columnHelper.accessor("isEnabled", {
			id: "isEnabled",
			header: labels.columns.state,
			enableSorting: false,
			cell: (info) =>
				info.getValue() ? (
					<Badge color="teal" variant="light">
						{labels.state.active}
					</Badge>
				) : (
					<Badge color="gray" variant="light">
						{labels.state.inactive}
					</Badge>
				),
		}),
		columnHelper.accessor("createdAt", {
			id: CATEGORY_SORT.CREATED_AT,
			header: labels.columns.createdAt,
			cell: (info) => formatDate(info.getValue(), locale),
		}),
		columnHelper.accessor("briefsCount", {
			id: CATEGORY_SORT.BRIEFS_COUNT,
			header: labels.columns.briefsCount,
		}),
		columnHelper.accessor("subscribersCount", {
			id: CATEGORY_SORT.SUBSCRIBERS_COUNT,
			header: labels.columns.subscribersCount,
		}),
		columnHelper.accessor((row) => row.lastBrief, {
			id: CATEGORY_SORT.LAST_BRIEF_AT,
			header: labels.columns.lastBrief,
			cell: (info) => {
				const lastBrief = info.getValue();

				if (!lastBrief) {
					return <Text c="dimmed">{labels.noBrief}</Text>;
				}

				return (
					<Group gap="xs" wrap="nowrap">
						<span>{formatCalendarDate(lastBrief.targetDate, locale)}</span>
						<Badge
							size="sm"
							variant="light"
							color={lastBrief.status === "failed" ? "red" : "gray"}
						>
							{t.auth.admin.jobStatus[lastBrief.status]}
						</Badge>
					</Group>
				);
			},
		}),
		columnHelper.display({
			id: "actions",
			header: labels.actions.column,
			cell: ({ row }) => (
				<RowActionsMenu
					category={row.original}
					labels={labels.actions}
					actions={rowActions}
				/>
			),
		}),
	]);
};

type RowActions = {
	onEdit: (category: AdminCategoryRow) => void;
	onToggleEnabled: (category: AdminCategoryRow) => void;
	onDelete: (category: AdminCategoryRow) => void;
	pendingId: string | undefined;
};

function RowActionsMenu({
	category,
	labels,
	actions,
}: {
	category: AdminCategoryRow;
	labels: Dictionary["auth"]["admin"]["categories"]["actions"];
	actions: RowActions;
}) {
	return (
		<Menu position="bottom-end" width={190} radius="sm" shadow="xs">
			<Menu.Target>
				<ActionIcon
					variant="subtle"
					color="gray"
					aria-label={labels.open(category.name)}
					loading={actions.pendingId === category.id}
				>
					<DotsIcon size={18} />
				</ActionIcon>
			</Menu.Target>

			<Menu.Dropdown>
				<Menu.Item onClick={() => actions.onEdit(category)}>
					{labels.edit}
				</Menu.Item>

				<Menu.Item onClick={() => actions.onToggleEnabled(category)}>
					{category.isEnabled ? labels.disable : labels.enable}
				</Menu.Item>

				<Menu.Divider />

				<Menu.Item color="red" onClick={() => actions.onDelete(category)}>
					{labels.delete}
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	);
}

export function CategoriesTable({
	search,
	result,
	isFetching,
	isError,
	onSearchChange,
	onCreate,
	onEdit,
	onToggleEnabled,
	onDelete,
	pendingActionId,
}: {
	search: AdminCategoriesSearch;
	result: Paginated<AdminCategoryRow> | undefined;
	isFetching: boolean;
	isError: boolean;
	onSearchChange: (patch: Partial<AdminCategoriesSearch>) => void;
	onCreate: () => void;
	onEdit: (category: AdminCategoryRow) => void;
	onToggleEnabled: (category: AdminCategoryRow) => void;
	onDelete: (category: AdminCategoryRow) => void;
	pendingActionId: string | undefined;
}) {
	const { t, locale } = useI18n();
	const labels = t.auth.admin.categories;

	const columns = useMemo(
		() =>
			buildColumns(t, locale, {
				onEdit,
				onToggleEnabled,
				onDelete,
				pendingId: pendingActionId,
			}),
		[t, locale, onEdit, onToggleEnabled, onDelete, pendingActionId],
	);

	return (
		<AdminTable
			columns={columns}
			result={result}
			search={search}
			sortKeys={CATEGORY_SORT_KEYS}
			labels={labels}
			isFetching={isFetching}
			isError={isError}
			onSearchChange={onSearchChange}
			numericColumnIds={NUMERIC_COLUMN_IDS}
			toolbar={
				<Button leftSection={<PlusIcon size={16} />} onClick={onCreate}>
					{labels.form.create}
				</Button>
			}
		/>
	);
}
