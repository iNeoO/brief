import { PAGINATION } from "@brief/common/constants";
import { Title } from "@mantine/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import classes from "#/components/briefs/briefs.module.css";
import { BriefsList } from "#/components/briefs/briefs-list";
import { SiteShell } from "#/components/layout/site-shell";
import { ROUTES } from "#/config/routes";
import { briefsQueryOptions, briefsSearchSchema } from "#/libs/api/briefs";
import { prefetchQueries } from "#/libs/api/query-loader";
import { useI18n } from "#/libs/i18n/context";
import { readStoredLocale } from "#/libs/i18n/locale-cookie";
import { headDictionary } from "#/libs/i18n/route-head";
import { pageHead } from "#/libs/seo/page-head";

export const Route = createFileRoute("/briefs/")({
	validateSearch: briefsSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await prefetchQueries(context.queryClient, [briefsQueryOptions(deps)]);

		return {
			locale: readStoredLocale(),
			page: deps.page ?? PAGINATION.DEFAULT_PAGE,
		};
	},
	head: ({ loaderData }) => {
		const { locale, t } = headDictionary(loaderData);
		const page = loaderData?.page ?? PAGINATION.DEFAULT_PAGE;
		const isFirstPage = page === PAGINATION.DEFAULT_PAGE;

		return pageHead({
			title: isFirstPage
				? t.seo.briefs.title
				: `${t.seo.briefs.title} — ${t.seo.page(page)}`,
			description: t.seo.briefs.description,
			path: isFirstPage ? ROUTES.briefs : `${ROUTES.briefs}?page=${page}`,
			locale,
		});
	},
	component: BriefsPage,
});

function BriefsPage() {
	const { t } = useI18n();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const page = search.page ?? PAGINATION.DEFAULT_PAGE;

	const briefs = useQuery({
		...briefsQueryOptions(search),
		placeholderData: keepPreviousData,
	});

	const handlePageChange = useCallback(
		(page: number) =>
			void navigate({ search: (previous) => ({ ...previous, page }) }),
		[navigate],
	);

	return (
		<SiteShell>
			<div className={`brief-shell ${classes.page}`}>
				<header className={classes.header}>
					<Title order={1} className={classes.title}>
						{t.briefs.title}
					</Title>
					<p className={classes.lead}>{t.briefs.lead}</p>
				</header>

				<BriefsList
					label={t.briefs.title}
					result={briefs.data}
					isFetching={briefs.isFetching}
					isError={briefs.isError}
					page={page}
					onPageChange={handlePageChange}
					empty={t.briefs.empty}
				/>
			</div>
		</SiteShell>
	);
}
