import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { CategoryJobsTable } from "#/components/admin/category-jobs-table";
import { ROUTES } from "#/config/routes";
import {
	type AdminCategoryJobsSearch,
	adminCategoryJobsQueryOptions,
	adminCategoryJobsSearchSchema,
} from "#/libs/api/admin-jobs";
import { queryLoader } from "#/libs/api/query-loader";
import { localisedHead } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/admin/jobs/category")({
	validateSearch: adminCategoryJobsSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: queryLoader(adminCategoryJobsQueryOptions),
	head: localisedHead((t) => ({
		title: t.auth.admin.jobs.tabs.category,
		path: ROUTES.adminJobsCategory,
		noindex: true,
	})),
	component: AdminCategoryJobsPage,
});

function AdminCategoryJobsPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const { data, isFetching, isError } = useQuery({
		...adminCategoryJobsQueryOptions(search),
		placeholderData: keepPreviousData,
	});

	const handleSearchChange = useCallback(
		(patch: Partial<AdminCategoryJobsSearch>) => {
			void navigate({
				search: (previous) => ({ ...previous, ...patch }),
				// Typing in the search box must not fill the history with keystrokes.
				replace: "q" in patch,
			});
		},
		[navigate],
	);

	return (
		<CategoryJobsTable
			search={search}
			result={data}
			isFetching={isFetching}
			isError={isError}
			onSearchChange={handleSearchChange}
		/>
	);
}
