import type { TopicCard as Topic } from "@brief/services";
import { Anchor, Title } from "@mantine/core";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback } from "react";
import { SiteShell } from "#/components/layout/site-shell";
import classes from "#/components/shell/shell.module.css";
import topicClasses from "#/components/topics/topics.module.css";
import { TopicsSection } from "#/components/topics/topics-section";
import { ROUTES } from "#/config/routes";
import { queryLoader } from "#/libs/api/query-loader";
import {
	availableTopicsQueryOptions,
	subscribe,
	subscribedTopicsQueryOptions,
	TOPICS_QUERY_KEY,
	topicsSearchSchema,
	unsubscribe,
} from "#/libs/api/topics";
import { requireUser } from "#/libs/auth/guards";
import { useI18n } from "#/libs/i18n/context";
import { localisedHead } from "#/libs/i18n/route-head";
import { notifyError, notifySuccess } from "#/libs/notify";

export const Route = createFileRoute("/topics")({
	validateSearch: topicsSearchSchema,
	loaderDeps: ({ search }) => search,
	beforeLoad: ({ context, location }) =>
		requireUser({ queryClient: context.queryClient, href: location.href }),
	loader: queryLoader(
		subscribedTopicsQueryOptions,
		availableTopicsQueryOptions,
	),
	head: localisedHead((t) => ({
		title: t.auth.topics.title,
		path: ROUTES.topics,
		noindex: true,
	})),
	component: TopicsPage,
});

function TopicsPage() {
	const { t } = useI18n();
	const labels = t.auth.topics;
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();

	const subscribed = useQuery({
		...subscribedTopicsQueryOptions(search),
		placeholderData: keepPreviousData,
	});

	const available = useQuery({
		...availableTopicsQueryOptions(search),
		placeholderData: keepPreviousData,
	});

	const patchSearch = useCallback(
		(patch: Partial<typeof search>, replace = false) =>
			void navigate({
				search: (previous) => ({ ...previous, ...patch }),
				replace,
			}),
		[navigate],
	);

	const refreshLists = useCallback(
		() => queryClient.invalidateQueries({ queryKey: TOPICS_QUERY_KEY }),
		[queryClient],
	);

	const subscribeToTopic = useMutation({
		mutationFn: (topic: Topic) => subscribe({ data: { categoryId: topic.id } }),
		onSuccess: async (_result, topic) => {
			await refreshLists();
			notifySuccess(labels.notifications.subscribed(topic.name));
		},
		onError: () => notifyError(t.auth.genericError),
	});

	const unsubscribeFromTopic = useMutation({
		mutationFn: (topic: Topic) =>
			unsubscribe({ data: { categoryId: topic.id } }),
		onSuccess: async (_result, topic) => {
			await refreshLists();
			notifySuccess(labels.notifications.unsubscribed(topic.name));
		},
		onError: () => notifyError(t.auth.genericError),
	});

	const handleSubscribedPage = useCallback(
		(page: number) => patchSearch({ subscribedPage: page }),
		[patchSearch],
	);

	const handleSubscribedTerm = useCallback(
		(term: string | undefined) =>
			patchSearch({ subscribedQ: term, subscribedPage: 1 }, true),
		[patchSearch],
	);

	const handleAvailablePage = useCallback(
		(page: number) => patchSearch({ availablePage: page }),
		[patchSearch],
	);

	const handleAvailableTerm = useCallback(
		(term: string | undefined) =>
			patchSearch({ availableQ: term, availablePage: 1 }, true),
		[patchSearch],
	);

	const handleUnsubscribe = useCallback(
		(topic: Topic) => unsubscribeFromTopic.mutate(topic),
		[unsubscribeFromTopic],
	);

	const handleSubscribe = useCallback(
		(topic: Topic) => subscribeToTopic.mutate(topic),
		[subscribeToTopic],
	);

	return (
		<SiteShell>
			<div className={`brief-shell ${classes.appMain}`}>
				<Anchor
					component={Link}
					to={ROUTES.home}
					className={topicClasses.backLink}
				>
					{labels.back}
				</Anchor>

				<Title order={1} className={classes.appHeading}>
					{labels.title}
				</Title>
				<p className={classes.appMeta}>{labels.lead}</p>

				<div className={topicClasses.sections}>
					<TopicsSection
						labels={labels.subscribed}
						result={subscribed.data}
						isFetching={subscribed.isFetching}
						isError={subscribed.isError}
						page={search.subscribedPage}
						term={search.subscribedQ}
						onPageChange={handleSubscribedPage}
						onTermChange={handleSubscribedTerm}
						onAction={handleUnsubscribe}
						pendingId={
							unsubscribeFromTopic.isPending
								? unsubscribeFromTopic.variables?.id
								: undefined
						}
						danger
					/>

					<TopicsSection
						labels={labels.available}
						result={available.data}
						isFetching={available.isFetching}
						isError={available.isError}
						page={search.availablePage}
						term={search.availableQ}
						onPageChange={handleAvailablePage}
						onTermChange={handleAvailableTerm}
						onAction={handleSubscribe}
						pendingId={
							subscribeToTopic.isPending
								? subscribeToTopic.variables?.id
								: undefined
						}
					/>
				</div>
			</div>
		</SiteShell>
	);
}
