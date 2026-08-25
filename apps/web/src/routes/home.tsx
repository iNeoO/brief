import { PAGINATION } from "@brief/common/constants";
import { Button, Title } from "@mantine/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback } from "react";
import briefClasses from "#/components/briefs/briefs.module.css";
import { BriefsList } from "#/components/briefs/briefs-list";
import { SiteShell } from "#/components/layout/site-shell";
import classes from "#/components/shell/shell.module.css";
import { ROUTES } from "#/config/routes";
import {
	briefsSearchSchema,
	subscribedBriefsQueryOptions,
} from "#/libs/api/briefs";
import { queryLoader } from "#/libs/api/query-loader";
import { requireUser } from "#/libs/auth/guards";
import { useI18n } from "#/libs/i18n/context";
import { localisedHead } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/home")({
	validateSearch: briefsSearchSchema,
	loaderDeps: ({ search }) => search,
	beforeLoad: ({ context, location }) =>
		requireUser({ queryClient: context.queryClient, href: location.href }),
	loader: queryLoader(subscribedBriefsQueryOptions),
	head: localisedHead((t) => ({
		title: t.auth.home.title,
		path: ROUTES.home,
		noindex: true,
	})),
	component: HomePage,
});

function HomePage() {
	const { t } = useI18n();
	const labels = t.auth.home;
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const briefs = useQuery({
		...subscribedBriefsQueryOptions(search),
		placeholderData: keepPreviousData,
	});

	const handlePageChange = useCallback(
		(page: number) =>
			void navigate({ search: (previous) => ({ ...previous, page }) }),
		[navigate],
	);

	return (
		<SiteShell>
			<div className={`brief-shell ${classes.appMain}`}>
				<header className={briefClasses.header}>
					<Title order={1} className={briefClasses.title}>
						{labels.title}
					</Title>
					<p className={briefClasses.lead}>{labels.lead}</p>
				</header>

				<BriefsList
					label={labels.title}
					result={briefs.data}
					isFetching={briefs.isFetching}
					isError={briefs.isError}
					page={search.page ?? PAGINATION.DEFAULT_PAGE}
					onPageChange={handlePageChange}
					empty={{
						title: labels.empty.title,
						body: labels.empty.body,
						action: (
							<Button component={Link} to={ROUTES.topics} size="sm" radius="sm">
								{labels.empty.cta}
							</Button>
						),
					}}
				/>
			</div>
		</SiteShell>
	);
}
