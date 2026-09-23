import { Title } from "@mantine/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import classes from "#/components/admin/admin.module.css";
import { UsersTable } from "#/components/admin/users-table";
import { ROUTES } from "#/config/routes";
import {
	type AdminUsersSearch,
	adminUsersQueryOptions,
	adminUsersSearchSchema,
} from "#/libs/api/admin-users";
import { queryLoader } from "#/libs/api/query-loader";
import { useI18n } from "#/libs/i18n/context";
import { localisedHead } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/admin/users")({
	validateSearch: adminUsersSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: queryLoader(adminUsersQueryOptions),
	head: localisedHead((t) => ({
		title: t.auth.admin.users.title,
		path: ROUTES.adminUsers,
		noindex: true,
	})),
	component: AdminUsersPage,
});

function AdminUsersPage() {
	const { t } = useI18n();
	const labels = t.auth.admin.users;
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const { data, isFetching, isError } = useQuery({
		...adminUsersQueryOptions(search),
		// The previous page stays on screen while the next one loads.
		placeholderData: keepPreviousData,
	});

	const handleSearchChange = useCallback(
		(patch: Partial<AdminUsersSearch>) => {
			navigate({
				search: (previous) => ({ ...previous, ...patch }),
				// Typing must not fill the history stack.
				replace: "q" in patch,
			});
		},
		[navigate],
	);

	return (
		<div className={classes.page}>
			<header>
				<Title order={1} size="h2" className={classes.heading}>
					{labels.title}
				</Title>
				<p className={classes.lead}>{labels.lead}</p>
			</header>

			<UsersTable
				search={search}
				result={data}
				isFetching={isFetching}
				isError={isError}
				onSearchChange={handleSearchChange}
			/>
		</div>
	);
}
