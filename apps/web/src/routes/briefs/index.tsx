import type { BriefCard } from "@brief/services";
import { Pagination, Title } from "@mantine/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import classes from "#/components/briefs/briefs.module.css";
import { formatBriefDate } from "#/components/home/latest-briefs";
import { SiteShell } from "#/components/layout/site-shell";
import { ROUTES } from "#/config/routes";
import { briefsQueryOptions, briefsSearchSchema } from "#/libs/api/briefs";
import { useI18n } from "#/libs/i18n/context";
import { readStoredLocale } from "#/libs/i18n/locale-cookie";
import { localisedTitle } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/briefs/")({
	validateSearch: briefsSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		const options = briefsQueryOptions(deps);

		if (import.meta.env.SSR) {
			await context.queryClient.ensureQueryData(options);
		} else {
			// Paging only warms the cache: blocking would freeze the list on the
			// previous page until the new one lands.
			void context.queryClient.prefetchQuery(options);
		}

		return { locale: readStoredLocale() };
	},
	head: localisedTitle((d) => d.briefs.title),
	component: BriefsPage,
});

function BriefsPage() {
	const { t } = useI18n();
	const search = Route.useSearch();

	const briefs = useQuery({
		...briefsQueryOptions(search),
		placeholderData: keepPreviousData,
	});

	const page = briefs.data;

	return (
		<SiteShell>
			<div className={`brief-shell ${classes.page}`}>
				<header className={classes.header}>
					<Title order={1} className={classes.title}>
						{t.briefs.title}
					</Title>
					<p className={classes.lead}>{t.briefs.lead}</p>
				</header>

				{briefs.isError ? (
					<Notice title={t.briefs.loadError} />
				) : page && page.items.length === 0 ? (
					<Notice title={t.briefs.empty.title} body={t.briefs.empty.body} />
				) : (
					<>
						<ul className={classes.list}>
							{(page?.items ?? []).map((brief) => (
								<BriefRow key={brief.id} brief={brief} />
							))}
						</ul>

						{page ? (
							<BriefsPagination page={page.page} pageCount={page.pageCount} />
						) : null}
					</>
				)}
			</div>
		</SiteShell>
	);
}

function BriefRow({ brief }: { brief: BriefCard }) {
	const { locale, t } = useI18n();

	return (
		<li className={classes.item}>
			<div className={classes.itemMeta}>
				<span className={classes.topic}>{brief.categoryName}</span>
				<span className={classes.date}>
					{formatBriefDate(brief.targetDate, locale)}
				</span>
				<span className={classes.date}>
					{t.brief.readTime(brief.readingMinutes)}
				</span>
			</div>

			<p className={classes.itemExcerpt}>{brief.excerpt}</p>

			<div className={classes.itemActions}>
				<Link to={ROUTES.brief} params={{ id: String(brief.id) }}>
					{t.brief.read}
				</Link>
			</div>
		</li>
	);
}

function BriefsPagination({
	page,
	pageCount,
}: {
	page: number;
	pageCount: number;
}) {
	const { t } = useI18n();
	const navigate = Route.useNavigate();

	// Same shape as the admin table: the search param is the source of truth,
	// and the control only navigates to it.
	return (
		<nav className={classes.pagination} aria-label={t.briefs.title}>
			<Pagination
				size="sm"
				total={pageCount}
				value={page}
				onChange={(next) =>
					void navigate({ search: (previous) => ({ ...previous, page: next }) })
				}
			/>

			<span className={classes.paginationPosition}>
				{t.briefs.pagination.position(page, pageCount)}
			</span>
		</nav>
	);
}

function Notice({ title, body }: { title: string; body?: string }) {
	return (
		<div className={classes.notice}>
			<p className={classes.noticeTitle}>{title}</p>
			{body ? <p className={classes.noticeBody}>{body}</p> : null}
		</div>
	);
}
