import { Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Notice } from "#/components/notice";
import { showcaseTopicsQueryOptions } from "#/libs/api/topics";
import { useI18n } from "#/libs/i18n/context";
import classes from "./home.module.css";

export function Topics() {
	const { locale, t } = useI18n();
	// Keyed by locale, so switching language swaps the teaser for the topics
	// that language actually publishes rather than relabelling the same chips.
	const topics = useQuery(showcaseTopicsQueryOptions(locale));

	const names = topics.data?.names ?? [];
	const remaining = topics.data?.remaining ?? 0;

	return (
		<section
			id="topics"
			className={`${classes.section} ${classes.sectionBordered} ${classes.sectionSurface}`}
		>
			<div className="brief-shell">
				<Title order={2} className={classes.sectionTitle}>
					{t.topics.title}
				</Title>

				<p className={classes.sectionLead}>{t.topics.lead}</p>

				{names.length === 0 ? (
					<Notice
						className={classes.topicNotice}
						title={topics.isError ? t.topics.loadError : t.topics.empty}
					/>
				) : (
					<ul className={classes.topicList}>
						{names.map((name) => (
							<li key={name} className={classes.topicChip}>
								{name}
							</li>
						))}

						{/* The catalogue can outgrow the teaser: the rest is a count, so
						    the row stays one line and the topics page keeps the list. */}
						{remaining > 0 ? (
							<li className={`${classes.topicChip} ${classes.topicChipMore}`}>
								{t.topics.more(remaining)}
							</li>
						) : null}
					</ul>
				)}
			</div>
		</section>
	);
}
