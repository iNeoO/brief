import { USER_SORT } from "@brief/common/constants";
import type { Paginated, UserSort } from "@brief/common/types";
import type { AdminUserRow } from "@brief/services";
import { Text } from "@mantine/core";
import { useMemo } from "react";
import type { AdminUsersSearch } from "#/libs/api/admin-users";
import { formatDate, formatDateTime } from "#/libs/format/date";
import type { Locale } from "#/libs/i18n/config";
import { useI18n } from "#/libs/i18n/context";
import type { Dictionary } from "#/libs/i18n/dictionaries";
import {
	AdminTable,
	type AdminTableColumns,
	createAdminColumnHelper,
} from "./admin-table";
import { NoValue } from "./job-cells";

const columnHelper = createAdminColumnHelper<AdminUserRow>();

const SORT_KEYS: readonly UserSort[] = Object.values(USER_SORT);

const NUMERIC_COLUMN_IDS: readonly string[] = [USER_SORT.SUBSCRIPTIONS_COUNT];

const buildColumns = (
	t: Dictionary,
	locale: Locale,
): AdminTableColumns<AdminUserRow> => {
	const labels = t.auth.admin.users;

	return columnHelper.columns([
		columnHelper.accessor("name", {
			id: USER_SORT.NAME,
			header: labels.columns.name,
			cell: (info) => <Text fw={500}>{info.getValue()}</Text>,
		}),
		columnHelper.accessor("email", {
			id: USER_SORT.EMAIL,
			header: labels.columns.email,
		}),
		columnHelper.accessor("createdAt", {
			id: USER_SORT.CREATED_AT,
			header: labels.columns.createdAt,
			cell: (info) => formatDate(info.getValue(), locale),
		}),
		columnHelper.accessor("subscriptionsCount", {
			id: USER_SORT.SUBSCRIPTIONS_COUNT,
			header: labels.columns.subscriptionsCount,
		}),
		columnHelper.accessor("lastBriefAt", {
			id: USER_SORT.LAST_BRIEF_AT,
			header: labels.columns.lastBriefAt,
			cell: (info) => {
				const lastBriefAt = info.getValue();

				return lastBriefAt ? formatDateTime(lastBriefAt, locale) : <NoValue />;
			},
		}),
	]);
};

export function UsersTable({
	search,
	result,
	isFetching,
	isError,
	onSearchChange,
}: Readonly<{
	search: AdminUsersSearch;
	result: Paginated<AdminUserRow> | undefined;
	isFetching: boolean;
	isError: boolean;
	onSearchChange: (patch: Partial<AdminUsersSearch>) => void;
}>) {
	const { t, locale } = useI18n();
	const columns = useMemo(() => buildColumns(t, locale), [t, locale]);

	return (
		<AdminTable
			columns={columns}
			result={result}
			search={search}
			sortKeys={SORT_KEYS}
			labels={t.auth.admin.users}
			isFetching={isFetching}
			isError={isError}
			onSearchChange={onSearchChange}
			numericColumnIds={NUMERIC_COLUMN_IDS}
		/>
	);
}
