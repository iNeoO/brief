import { FETCH_JOB_SORT, JOB_STATUS } from "@brief/common/constants";
import type { FetchJobSort, JobStatus, Paginated } from "@brief/common/types";
import type { AdminFetchJobRow } from "@brief/services";
import { Text } from "@mantine/core";
import { useMemo } from "react";
import type { AdminFetchJobsSearch } from "#/libs/api/admin-jobs";
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

const columnHelper = createAdminColumnHelper<AdminFetchJobRow>();

const SORT_KEYS: readonly FetchJobSort[] = Object.values(FETCH_JOB_SORT);

const STATUSES: readonly JobStatus[] = Object.values(JOB_STATUS);

const NUMERIC_COLUMN_IDS: readonly string[] = [
	FETCH_JOB_SORT.RETRY,
	FETCH_JOB_SORT.ARTICLES_COUNT,
];

const buildColumns = (
	t: Dictionary,
	locale: Locale,
): AdminTableColumns<AdminFetchJobRow> => {
	const labels = t.auth.admin.jobs.fetch;

	return columnHelper.columns([
		columnHelper.accessor((row) => row.provider.name, {
			id: FETCH_JOB_SORT.PROVIDER,
			header: labels.columns.provider,
			cell: (info) => <Text fw={500}>{info.getValue()}</Text>,
		}),
		columnHelper.accessor("targetDate", {
			id: FETCH_JOB_SORT.TARGET_DATE,
			header: labels.columns.targetDate,
			cell: (info) => formatCalendarDate(info.getValue(), locale),
		}),
		columnHelper.accessor("status", {
			id: FETCH_JOB_SORT.STATUS,
			header: labels.columns.status,
			cell: (info) => <JobStatusBadge status={info.getValue()} />,
		}),
		columnHelper.accessor("retry", {
			id: FETCH_JOB_SORT.RETRY,
			header: labels.columns.retry,
		}),
		columnHelper.accessor("articlesCount", {
			id: FETCH_JOB_SORT.ARTICLES_COUNT,
			header: labels.columns.articlesCount,
		}),
		columnHelper.accessor("durationSeconds", {
			id: FETCH_JOB_SORT.DURATION,
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
			id: FETCH_JOB_SORT.CREATED_AT,
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

export function FetchJobsTable({
	search,
	result,
	isFetching,
	isError,
	onSearchChange,
}: {
	search: AdminFetchJobsSearch;
	result: Paginated<AdminFetchJobRow> | undefined;
	isFetching: boolean;
	isError: boolean;
	onSearchChange: (patch: Partial<AdminFetchJobsSearch>) => void;
}) {
	const { t, locale } = useI18n();
	const columns = useMemo(() => buildColumns(t, locale), [t, locale]);

	return (
		<AdminTable
			columns={columns}
			result={result}
			search={search}
			sortKeys={SORT_KEYS}
			labels={t.auth.admin.jobs.fetch}
			isFetching={isFetching}
			isError={isError}
			onSearchChange={onSearchChange}
			numericColumnIds={NUMERIC_COLUMN_IDS}
			minWidth={980}
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
