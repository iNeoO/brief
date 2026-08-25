import type { Paginated } from "@brief/common/types";
import type { TopicCard as Topic } from "@brief/services";
import { Box, LoadingOverlay, Title } from "@mantine/core";
import { DebouncedSearchInput } from "#/components/debounced-search-input";
import { Notice } from "#/components/notice";
import { PaginationFooter, usePageClamp } from "#/components/pagination-footer";
import { useI18n } from "#/libs/i18n/context";
import type { Dictionary } from "#/libs/i18n/dictionaries";
import { TopicCard } from "./topic-card";
import classes from "./topics.module.css";

/**
 * The dictionary is the contract: both sections must offer the same labels,
 * which the type check at the call site enforces.
 */
export type TopicsSectionLabels = Dictionary["auth"]["topics"]["subscribed"];

/**
 * One paginated list of topics with its own search box. Both sections of the
 * page are this component: they differ by their labels, their data and what
 * their button does.
 */
export function TopicsSection({
	labels,
	result,
	isFetching,
	isError,
	page,
	term,
	onPageChange,
	onTermChange,
	onAction,
	pendingId,
	danger = false,
}: {
	labels: TopicsSectionLabels;
	result: Paginated<Topic> | undefined;
	isFetching: boolean;
	isError: boolean;
	page: number;
	term: string | undefined;
	onPageChange: (page: number) => void;
	onTermChange: (term: string | undefined) => void;
	onAction: (topic: Topic) => void;
	pendingId: string | undefined;
	danger?: boolean;
}) {
	const { t } = useI18n();
	const hasSearch = Boolean(term);

	usePageClamp(result, onPageChange);

	return (
		<section className={classes.section}>
			<div className={classes.sectionHeader}>
				<Title order={2} size="h3" className={classes.sectionTitle}>
					{labels.title}
				</Title>

				{result ? (
					<span className={classes.sectionCount}>{result.total}</span>
				) : null}
			</div>

			<p className={classes.sectionLead}>{labels.lead}</p>

			<DebouncedSearchInput
				value={term}
				onCommit={onTermChange}
				labels={labels.search}
				className={classes.search}
			/>

			{isError ? (
				<Notice title={t.auth.topics.loadError} />
			) : result && result.items.length === 0 ? (
				hasSearch ? (
					<Notice
						title={labels.noResults.title}
						body={labels.noResults.body(term ?? "")}
					/>
				) : (
					<Notice title={labels.empty.title} body={labels.empty.body} />
				)
			) : (
				<Box pos="relative">
					{/* Keeps the previous page in place while the next one loads, so
					    the section does not collapse on every keystroke. */}
					<LoadingOverlay
						visible={isFetching}
						zIndex={1}
						overlayProps={{ blur: 1 }}
					/>

					<ul className={classes.list}>
						{(result?.items ?? []).map((topic) => (
							<TopicCard
								key={topic.id}
								topic={topic}
								actionLabel={labels.action}
								onAction={onAction}
								isPending={pendingId === topic.id}
								danger={danger}
							/>
						))}
					</ul>
				</Box>
			)}

			<PaginationFooter
				label={labels.title}
				page={page}
				pageCount={result?.pageCount}
				position={t.auth.topics.pagination}
				onPageChange={onPageChange}
			/>
		</section>
	);
}
