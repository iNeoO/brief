import type { Paginated } from "@brief/common/types";
import type { TopicCard as Topic } from "@brief/services";
import {
	Box,
	CloseButton,
	LoadingOverlay,
	Pagination,
	TextInput,
	Title,
} from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "#/libs/i18n/context";
import type { Dictionary } from "#/libs/i18n/dictionaries";
import { TopicCard } from "./topic-card";
import classes from "./topics.module.css";

const SEARCH_DEBOUNCE_MS = 300;

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

	// A page that no longer exists — the last subscription of page 3 was just
	// removed, or the URL was hand-edited — sends the reader to the last one
	// rather than showing an empty list.
	useEffect(() => {
		if (result && result.page > result.pageCount) {
			onPageChange(result.pageCount);
		}
	}, [result, onPageChange]);

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

			<SearchInput
				value={term}
				onTermChange={onTermChange}
				labels={labels}
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

			{result && result.pageCount > 1 ? (
				<nav className={classes.pagination} aria-label={labels.title}>
					<Pagination
						size="sm"
						total={result.pageCount}
						value={page}
						onChange={onPageChange}
					/>

					<span className={classes.paginationPosition}>
						{t.auth.topics.pagination(page, result.pageCount)}
					</span>
				</nav>
			) : null}
		</section>
	);
}

function SearchInput({
	value,
	onTermChange,
	labels,
	className,
}: {
	value: string | undefined;
	onTermChange: (term: string | undefined) => void;
	labels: TopicsSectionLabels;
	className: string;
}) {
	const [term, setTerm] = useState(value ?? "");
	// What we last pushed to the URL. Without it, the echo of our own update
	// would overwrite the characters typed while the debounce was running.
	const committed = useRef(value ?? "");

	useEffect(() => {
		const next = value ?? "";

		if (next === committed.current) {
			return;
		}

		committed.current = next;
		setTerm(next);
	}, [value]);

	useEffect(() => {
		if (term === committed.current) {
			return;
		}

		const timeout = setTimeout(() => {
			committed.current = term;
			onTermChange(term.trim() || undefined);
		}, SEARCH_DEBOUNCE_MS);

		return () => clearTimeout(timeout);
	}, [term, onTermChange]);

	return (
		<TextInput
			className={className}
			aria-label={labels.search.label}
			placeholder={labels.search.placeholder}
			value={term}
			onChange={(event) => setTerm(event.currentTarget.value)}
			rightSection={
				term ? (
					<CloseButton
						size="sm"
						aria-label={labels.search.clear}
						onClick={() => setTerm("")}
					/>
				) : null
			}
		/>
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
