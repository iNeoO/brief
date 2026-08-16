import { Title } from "@mantine/core";
import { useI18n } from "#/libs/i18n/context";
import classes from "./home.module.css";

export function Topics() {
	const { t } = useI18n();

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

				<ul className={classes.topicList}>
					{t.topics.items.map((topic) => (
						<li key={topic} className={classes.topicChip}>
							{topic}
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
