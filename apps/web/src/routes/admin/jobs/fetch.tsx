import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { FetchJobsTable } from "#/components/admin/fetch-jobs-table";
import { ROUTES } from "#/config/routes";
import {
	type AdminFetchJobsSearch,
	adminFetchJobsQueryOptions,
	adminFetchJobsSearchSchema,
} from "#/libs/api/admin-jobs";
import { queryLoader } from "#/libs/api/query-loader";
import { localisedHead } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/admin/jobs/fetch")({
	validateSearch: adminFetchJobsSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: queryLoader(adminFetchJobsQueryOptions),
	head: localisedHead((t) => ({
		title: t.auth.admin.jobs.tabs.fetch,
		path: ROUTES.adminJobsFetch,
		noindex: true,
	})),
	component: AdminFetchJobsPage,
});

function AdminFetchJobsPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const { data, isFetching, isError } = useQuery({
		...adminFetchJobsQueryOptions(search),
		placeholderData: keepPreviousData,
	});

	const handleSearchChange = useCallback(
		(patch: Partial<AdminFetchJobsSearch>) => {
			void navigate({
				search: (previous) => ({ ...previous, ...patch }),
				replace: "q" in patch,
			});
		},
		[navigate],
	);

	return (
		<FetchJobsTable
			search={search}
			result={data}
			isFetching={isFetching}
			isError={isError}
			onSearchChange={handleSearchChange}
		/>
	);
}
