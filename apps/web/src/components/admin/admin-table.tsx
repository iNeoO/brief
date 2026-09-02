import { PAGINATION } from "@brief/common/constants";
import type { Paginated, SortOrder } from "@brief/common/types";
import {
	Alert,
	Box,
	Button,
	Group,
	LoadingOverlay,
	Pagination,
	Select,
	Table,
} from "@mantine/core";
import {
	type ColumnDef,
	createColumnHelper,
	functionalUpdate,
	type OnChangeFn,
	type PaginationState,
	type RowData,
	rowPaginationFeature,
	rowSortingFeature,
	type SortingState,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { useCallback, useMemo } from "react";
import {
	DebouncedSearchInput,
	type SearchInputLabels,
} from "#/components/debounced-search-input";
import { ChevronDownIcon } from "#/components/icons";
import { Notice } from "#/components/notice";
import { useI18n } from "#/libs/i18n/context";
import classes from "./admin.module.css";

/**
 * Sorting and pagination are registered so the table exposes their state and
 * APIs; both run in `manual` mode, because the SQL query already returns the
 * ordered page.
 */
export const adminTableFeatures = tableFeatures({
	rowSortingFeature,
	rowPaginationFeature,
});

/** The column helper every admin table builds its columns with. */
export const createAdminColumnHelper = <TRow extends RowData>() =>
	createColumnHelper<typeof adminTableFeatures, TRow>();

/**
 * A built column list. The value type has to be erased for the array to hold
 * columns of different value types at once — which is what
 * `columnHelper.columns()` returns, and it keeps each column's own type at the
 * call site where the cell is written.
 */
export type AdminTableColumns<TRow extends RowData> = Array<
	ColumnDef<typeof adminTableFeatures, TRow, unknown>
>;

/**
 * The list state an admin table reads out of its URL. Each table's own search
 * schema is a superset of this — a status filter, a tab — and only these four
 * are the table's business.
 */
export type AdminTableSearch<TSort extends string> = {
	page: number;
	pageSize: number;
	sort: TSort;
	order: SortOrder;
	q?: string;
};

/**
 * What each table says about itself. The generic strings — sorting, paging,
 * clearing a search — come from `admin.table` instead, so the four tables
 * cannot drift apart on them.
 */
export type AdminTableLabels = {
	search: SearchInputLabels;
	error: string;
	empty: { title: string; body: string };
	noResults: { title: string; body: (term: string) => string };
};

// Stable reference: a fresh `[]` on every render invalidates the row model.
const EMPTY_ROWS: never[] = [];

/**
 * The shell every admin list shares: a search box, one page of rows with
 * sortable headers, and a pager. It owns nothing about the domain — the
 * columns, the labels and the extra toolbar controls come from the page, and
 * every state change leaves as a search-param patch for the route to write to
 * the URL.
 */
export function AdminTable<TRow extends RowData, TSort extends string>({
	columns,
	result,
	search,
	sortKeys,
	labels,
	isFetching,
	isError,
	onSearchChange,
	toolbar,
	numericColumnIds = [],
	minWidth = 860,
}: {
	columns: AdminTableColumns<TRow>;
	result: Paginated<TRow> | undefined;
	search: AdminTableSearch<TSort>;
	/** The keys this list accepts, which is also what guards a header click. */
	sortKeys: readonly TSort[];
	labels: AdminTableLabels;
	isFetching: boolean;
	isError: boolean;
	onSearchChange: (patch: Partial<AdminTableSearch<TSort>>) => void;
	/** Controls that sit next to the search box: a filter, a create button. */
	toolbar?: React.ReactNode;
	/** Columns whose figures are right-aligned and tabular. */
	numericColumnIds?: readonly string[];
	minWidth?: number;
}) {
	const { t } = useI18n();
	const tableLabels = t.auth.admin.table;

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

			if (!next || !(sortKeys as readonly string[]).includes(next.id)) {
				return;
			}

			onSearchChange({
				sort: next.id as TSort,
				order: next.desc ? "desc" : "asc",
				page: 1,
			});
		},
		[onSearchChange, sorting, sortKeys],
	);

	const table = useTable({
		features: adminTableFeatures,
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
				<DebouncedSearchInput
					value={search.q}
					onCommit={(q) => onSearchChange({ q, page: 1 })}
					labels={labels.search}
					className={classes.search}
				/>

				{toolbar}
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
					<Table highlightOnHover verticalSpacing="sm" miw={minWidth}>
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
													numericColumnIds.includes(header.column.id)
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
																? tableLabels.sort.descending
																: tableLabels.sort.ascending
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
													numericColumnIds.includes(cell.column.id)
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

				{/* The table already draws the edge around this, hence `bare`. */}
				{rows.length === 0 && !isError ? (
					search.q ? (
						<Notice
							variant="bare"
							title={labels.noResults.title}
							body={labels.noResults.body(search.q)}
						>
							<Button
								variant="default"
								size="sm"
								onClick={() => onSearchChange({ q: undefined, page: 1 })}
							>
								{tableLabels.clearSearch}
							</Button>
						</Notice>
					) : (
						<Notice
							variant="bare"
							title={labels.empty.title}
							body={labels.empty.body}
						/>
					)
				) : null}
			</Box>

			{total > 0 ? (
				<div className={classes.footer}>
					<span className={classes.footerCount}>
						{tableLabels.pagination.range(firstRowIndex, lastRowIndex, total)}
					</span>

					<Group gap="sm" wrap="nowrap">
						<Select
							size="sm"
							className={classes.pageSize}
							aria-label={tableLabels.pagination.pageSize}
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
