import {
	CATEGORY_JOB_SORT,
	CATEGORY_JOB_STATUS,
} from "@brief/common/constants";
import type {
	CategoryJobSort,
	CategoryJobStatus,
	Paginated,
} from "@brief/common/types";
import type { AdminCategoryJobRow } from "@brief/services";
import { Badge, Group, Text } from "@mantine/core";
import { useMemo } from "react";
import type { AdminCategoryJobsSearch } from "#/libs/api/admin-jobs";
import { formatCalendarDate, formatDateTime } from "#/libs/format/date";
import { formatDuration } from "#/libs/format/duration";
import type { Locale } from "#/libs/i18n/config";
import { useI18n } from "#/libs/i18n/context";
import type { Dictionary } from "#/libs/i18n/dictionaries";
import {
	AdminTable,
	type AdminTableColumns,
	createAdminColumnHelper,
} from "./admin-table";
import { ErrorCell, JobStatusBadge, NoValue } from "./job-cells";
import { JobStatusFilter } from "./job-status-filter";

const columnHelper = createAdminColumnHelper<AdminCategoryJobRow>();

const SORT_KEYS: readonly CategoryJobSort[] = Object.values(CATEGORY_JOB_SORT);

const STATUSES: readonly CategoryJobStatus[] =
	Object.values(CATEGORY_JOB_STATUS);

const NUMERIC_COLUMN_IDS: readonly string[] = [
	CATEGORY_JOB_SORT.RETRY,
	CATEGORY_JOB_SORT.ARTICLES_COUNT,
	CATEGORY_JOB_SORT.TOTAL_TOKENS,
];

/**
 * The step a run is on, which only says something while it is running: a
 * finished job sits on the last step it went through, and reading that as
 * "sending" would be wrong.
 */
const IN_FLIGHT_STATUSES: readonly CategoryJobStatus[] = [
	CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS,
	CATEGORY_JOB_STATUS.PENDING,
	CATEGORY_JOB_STATUS.RUNNING,
];

const buildColumns = (
	t: Dictionary,
	locale: Locale,
): AdminTableColumns<AdminCategoryJobRow> => {
	const labels = t.auth.admin.jobs.category;

	return columnHelper.columns([
		columnHelper.accessor((row) => row.category.name, {
			id: CATEGORY_JOB_SORT.CATEGORY,
			header: labels.columns.category,
			cell: (info) => <Text fw={500}>{info.getValue()}</Text>,
		}),
		columnHelper.accessor("targetDate", {
			id: CATEGORY_JOB_SORT.TARGET_DATE,
			header: labels.columns.targetDate,
			cell: (info) => formatCalendarDate(info.getValue(), locale),
		}),
		columnHelper.accessor("status", {
			id: CATEGORY_JOB_SORT.STATUS,
			header: labels.columns.status,
			cell: (info) => <JobStatusBadge status={info.getValue()} />,
		}),
		columnHelper.accessor("state", {
			id: "state",
			header: labels.columns.state,
			enableSorting: false,
			cell: ({ row }) =>
				IN_FLIGHT_STATUSES.includes(row.original.status) ? (
					<Text size="sm">{t.auth.admin.jobState[row.original.state]}</Text>
				) : (
					<NoValue />
				),
		}),
		columnHelper.accessor("retry", {
			id: CATEGORY_JOB_SORT.RETRY,
			header: labels.columns.retry,
		}),
		columnHelper.accessor("articlesCount", {
			id: CATEGORY_JOB_SORT.ARTICLES_COUNT,
			header: labels.columns.articlesCount,
		}),
		columnHelper.accessor("totalTokens", {
			id: CATEGORY_JOB_SORT.TOTAL_TOKENS,
			header: labels.columns.totalTokens,
			cell: (info) => info.getValue().toLocaleString(locale),
		}),
		columnHelper.accessor((row) => row.deliveries, {
			id: CATEGORY_JOB_SORT.DELIVERIES_FAILED,
			header: labels.columns.deliveries,
			cell: (info) => {
				const deliveries = info.getValue();

				// No delivery row at all: this brief never reached the fan-out, which
				// is not the same as one whose readers are still queued.
				if (deliveries.total === 0) {
					return <NoValue />;
				}

				return (
					<Group gap="xs" wrap="nowrap">
						<span>{deliveries.finished}</span>

						{deliveries.failed > 0 ? (
							<Badge size="sm" variant="light" color="red">
								{labels.deliveriesFailed(deliveries.failed)}
							</Badge>
						) : null}
					</Group>
				);
			},
		}),
		columnHelper.accessor("durationSeconds", {
			id: CATEGORY_JOB_SORT.DURATION,
			header: labels.columns.duration,
			cell: (info) => {
				const seconds = info.getValue();

				return seconds === null ? <NoValue /> : formatDuration(seconds);
			},
		}),
		columnHelper.accessor("error", {
			id: "error",
			header: labels.columns.error,
			enableSorting: false,
			cell: (info) => <ErrorCell error={info.getValue()} />,
		}),
		columnHelper.accessor("createdAt", {
			id: CATEGORY_JOB_SORT.CREATED_AT,
			header: labels.columns.createdAt,
			cell: (info) => formatDateTime(info.getValue(), locale),
		}),
		columnHelper.accessor("finishedAt", {
			id: "finishedAt",
			header: labels.columns.finishedAt,
			enableSorting: false,
			cell: (info) => {
				const finishedAt = info.getValue();

				return finishedAt ? formatDateTime(finishedAt, locale) : <NoValue />;
			},
		}),
	]);
};

export function CategoryJobsTable({
	search,
	result,
	isFetching,
	isError,
	onSearchChange,
}: {
	search: AdminCategoryJobsSearch;
	result: Paginated<AdminCategoryJobRow> | undefined;
	isFetching: boolean;
	isError: boolean;
	onSearchChange: (patch: Partial<AdminCategoryJobsSearch>) => void;
}) {
	const { t, locale } = useI18n();
	const columns = useMemo(() => buildColumns(t, locale), [t, locale]);

	return (
		<AdminTable
			columns={columns}
			result={result}
			search={search}
			sortKeys={SORT_KEYS}
			labels={t.auth.admin.jobs.category}
			isFetching={isFetching}
			isError={isError}
			onSearchChange={onSearchChange}
			numericColumnIds={NUMERIC_COLUMN_IDS}
			minWidth={1180}
			toolbar={
				<JobStatusFilter
					statuses={STATUSES}
					value={search.status}
					onChange={(status) => onSearchChange({ status, page: 1 })}
				/>
			}
		/>
	);
}
