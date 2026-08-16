import { CATEGORY_SORT, PAGINATION } from "@brief/common/constants";
import type { CategorySort, Paginated } from "@brief/common/types";
import type { AdminCategoryRow } from "@brief/services";
import {
	ActionIcon,
	Alert,
	Badge,
	Box,
	Button,
	CloseButton,
	Group,
	LoadingOverlay,
	Menu,
	Pagination,
	Select,
	Table,
	Text,
	TextInput,
	Tooltip,
} from "@mantine/core";
import {
	createColumnHelper,
	functionalUpdate,
	type OnChangeFn,
	type PaginationState,
	rowPaginationFeature,
	rowSortingFeature,
	type SortingState,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, DotsIcon, PlusIcon } from "#/components/icons";
import type { AdminCategoriesSearch } from "#/libs/api/admin-categories";
import type { Locale } from "#/libs/i18n/config";
import { useI18n } from "#/libs/i18n/context";
import type { Dictionary } from "#/libs/i18n/dictionaries";
import classes from "./admin.module.css";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Sorting and pagination are registered so the table exposes their state and
 * APIs; both run in `manual` mode, because the SQL query already returns the
 * ordered page.
 */
const features = tableFeatures({ rowSortingFeature, rowPaginationFeature });

const columnHelper = createColumnHelper<typeof features, AdminCategoryRow>();

// Stable reference: a fresh `[]` on every render invalidates the row model.
const EMPTY_ROWS: AdminCategoryRow[] = [];

const NUMERIC_COLUMN_IDS: readonly string[] = [
	CATEGORY_SORT.BRIEFS_COUNT,
	CATEGORY_SORT.SUBSCRIBERS_COUNT,
];

const isCategorySort = (id: string): id is CategorySort =>
	(Object.values(CATEGORY_SORT) as string[]).includes(id);

const formatTimestamp = (date: Date, locale: Locale) =>
	new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);

/**
 * A brief's target date is a calendar day, stored without a time zone. Read it
 * in UTC, otherwise a reader west of Greenwich sees the day before.
 */
const formatTargetDate = (date: Date, locale: Locale) =>
	new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeZone: "UTC",
	}).format(date);

const buildColumns = (
	t: Dictionary,
	locale: Locale,
	rowActions: RowActions,
) => {
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
		columnHelper.accessor("isEnable", {
			id: "isEnable",
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
			cell: (info) => formatTimestamp(info.getValue(), locale),
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
						<span>{formatTargetDate(lastBrief.targetDate, locale)}</span>
						<Badge
							size="sm"
							variant="light"
							color={lastBrief.status === "failed" ? "red" : "gray"}
						>
							{labels.jobStatus[lastBrief.status]}
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
					{category.isEnable ? labels.disable : labels.enable}
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

	const pagination = useMemo<PaginationState>(
		() => ({ pageIndex: search.page - 1, pageSize: search.pageSize }),
		[search.page, search.pageSize],
	);

	const sorting = useMemo<SortingState>(
		() => [{ id: search.sort, desc: search.order === "desc" }],
		[search.sort, search.order],
	);

	const handlePaginationChange = useCallback<OnChangeFn<PaginationState>>(
		(updater) => {
			const next = functionalUpdate(updater, pagination);

			onSearchChange({
				page: next.pageIndex + 1,
				// A bigger page invalidates the current offset, so go back to the top.
				...(next.pageSize === pagination.pageSize
					? {}
					: { pageSize: next.pageSize, page: 1 }),
			});
		},
		[onSearchChange, pagination],
	);

	const handleSortingChange = useCallback<OnChangeFn<SortingState>>(
		(updater) => {
			const [next] = functionalUpdate(updater, sorting);

			if (!next || !isCategorySort(next.id)) {
				return;
			}

			onSearchChange({
				sort: next.id,
				order: next.desc ? "desc" : "asc",
				page: 1,
			});
		},
		[onSearchChange, sorting],
	);

	const table = useTable({
		features,
		columns,
		data: result?.items ?? EMPTY_ROWS,
		rowCount: result?.total,
		manualPagination: true,
		manualSorting: true,
		// The list is always ordered by something, so a third click on a header
		// returns to ascending instead of to an undefined order.
		enableSortingRemoval: false,
		enableMultiSort: false,
		state: { pagination, sorting },
		onPaginationChange: handlePaginationChange,
		onSortingChange: handleSortingChange,
	});

	const total = result?.total ?? 0;
	const rows = table.getRowModel().rows;
	const firstRowIndex = (search.page - 1) * search.pageSize + 1;
	const lastRowIndex = Math.min(search.page * search.pageSize, total);

	return (
		<div className={classes.page}>
			<div className={classes.toolbar}>
				<CategorySearchInput
					value={search.q}
					onSearchChange={onSearchChange}
					labels={labels.search}
				/>

				<Button leftSection={<PlusIcon size={16} />} onClick={onCreate}>
					{labels.form.create}
				</Button>
			</div>

			{isError ? (
				<Alert color="red" variant="light">
					{labels.error}
				</Alert>
			) : null}

			<Box pos="relative">
				<LoadingOverlay
					visible={isFetching}
					zIndex={1}
					overlayProps={{ blur: 1 }}
				/>

				<div className={classes.tableScroll}>
					<Table highlightOnHover verticalSpacing="sm" miw={860}>
						<Table.Thead>
							{table.getHeaderGroups().map((headerGroup) => (
								<Table.Tr key={headerGroup.id}>
									{headerGroup.headers.map((header) => {
										const sorted = header.column.getIsSorted();

										return (
											<Table.Th
												key={header.id}
												aria-sort={
													sorted === "asc"
														? "ascending"
														: sorted === "desc"
															? "descending"
															: "none"
												}
												className={
													NUMERIC_COLUMN_IDS.includes(header.column.id)
														? classes.numeric
														: undefined
												}
											>
												{header.isPlaceholder ? null : header.column.getCanSort() ? (
													<button
														type="button"
														className={classes.sortButton}
														onClick={header.column.getToggleSortingHandler()}
														aria-label={
															sorted === "asc"
																? labels.sort.descending
																: labels.sort.ascending
														}
													>
														<table.FlexRender header={header} />
														<ChevronDownIcon
															size={14}
															className={[
																classes.sortIndicator,
																sorted === "asc"
																	? classes.sortIndicatorAsc
																	: "",
																sorted ? classes.sortIndicatorActive : "",
															]
																.filter(Boolean)
																.join(" ")}
														/>
													</button>
												) : (
													<table.FlexRender header={header} />
												)}
											</Table.Th>
										);
									})}
								</Table.Tr>
							))}
						</Table.Thead>

						{rows.length > 0 ? (
							<Table.Tbody>
								{rows.map((row) => (
									<Table.Tr key={row.id}>
										{row.getAllCells().map((cell) => (
											<Table.Td
												key={cell.id}
												className={
													NUMERIC_COLUMN_IDS.includes(cell.column.id)
														? classes.numeric
														: undefined
												}
											>
												<table.FlexRender cell={cell} />
											</Table.Td>
										))}
									</Table.Tr>
								))}
							</Table.Tbody>
						) : null}
					</Table>
				</div>

				{rows.length === 0 && !isError ? (
					<div className={classes.empty}>
						{search.q ? (
							<>
								<p className={classes.emptyTitle}>{labels.noResults.title}</p>
								<p className={classes.emptyBody}>
									{labels.noResults.body(search.q)}
								</p>
								<Button
									variant="default"
									size="sm"
									onClick={() => onSearchChange({ q: undefined, page: 1 })}
								>
									{labels.noResults.clear}
								</Button>
							</>
						) : (
							<>
								<p className={classes.emptyTitle}>{labels.empty.title}</p>
								<p className={classes.emptyBody}>{labels.empty.body}</p>
							</>
						)}
					</div>
				) : null}
			</Box>

			{total > 0 ? (
				<div className={classes.footer}>
					<span className={classes.footerCount}>
						{labels.pagination.range(firstRowIndex, lastRowIndex, total)}
					</span>

					<Group gap="sm" wrap="nowrap">
						<Select
							size="sm"
							className={classes.pageSize}
							aria-label={labels.pagination.pageSize}
							data={PAGINATION.PAGE_SIZE_OPTIONS.map(String)}
							value={String(search.pageSize)}
							allowDeselect={false}
							onChange={(value) =>
								value ? table.setPageSize(Number(value)) : undefined
							}
						/>

						<Pagination
							size="sm"
							total={table.getPageCount()}
							value={search.page}
							onChange={(page) => table.setPageIndex(page - 1)}
						/>
					</Group>
				</div>
			) : null}
		</div>
	);
}

function CategorySearchInput({
	value,
	onSearchChange,
	labels,
}: {
	value: string | undefined;
	onSearchChange: (patch: Partial<AdminCategoriesSearch>) => void;
	labels: Dictionary["auth"]["admin"]["categories"]["search"];
}) {
	const [term, setTerm] = useState(value ?? "");
	// What we last pushed to the URL. Without it, the echo of our own update
	// would overwrite the characters typed while the debounce was running.
	const committed = useRef(value ?? "");

	useEffect(() => {
		const next = value ?? "";

		if (next === committed.current) {
			return;
		}

		committed.current = next;
		setTerm(next);
	}, [value]);

	useEffect(() => {
		if (term === committed.current) {
			return;
		}

		const timeout = setTimeout(() => {
			committed.current = term;
			onSearchChange({ q: term.trim() || undefined, page: 1 });
		}, SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(timeout);
	}, [term, onSearchChange]);

	return (
		<TextInput
			className={classes.search}
			aria-label={labels.label}
			placeholder={labels.placeholder}
			value={term}
			onChange={(event) => setTerm(event.currentTarget.value)}
			rightSection={
				term ? (
					<CloseButton
						size="sm"
						aria-label={labels.clear}
						onClick={() => setTerm("")}
					/>
				) : null
			}
		/>
	);
}
