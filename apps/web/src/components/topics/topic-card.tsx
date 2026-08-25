import type { TopicCard as Topic } from "@brief/services";
import { Badge, Button } from "@mantine/core";
import { formatDate } from "#/libs/format/date";
import { useI18n } from "#/libs/i18n/context";
import classes from "./topics.module.css";

export function TopicCard({
	topic,
	actionLabel,
	onAction,
	isPending,
	danger = false,
}: {
	topic: Topic;
	actionLabel: string;
	onAction: (topic: Topic) => void;
	isPending: boolean;
	/** Unsubscribing removes something the reader chose, so it reads as such. */
	danger?: boolean;
}) {
	const { locale, t } = useI18n();
	const labels = t.auth.topics;

	return (
		<li className={classes.card}>
			<div className={classes.cardBody}>
				<div className={classes.cardTitle}>
					<h3 className={classes.cardName}>{topic.name}</h3>

					{topic.isEnabled ? null : (
						<Badge color="gray" variant="light" size="sm">
							{labels.card.paused}
						</Badge>
					)}
				</div>

				<p className={classes.cardDescription}>{topic.description}</p>

				<div className={classes.cardMeta}>
					<span>
						{labels.card.created(formatDate(topic.createdAt, locale))}
					</span>
					<span className={classes.cardMetaSeparator} aria-hidden="true" />
					<span>{labels.card.briefs(topic.briefsCount)}</span>

					{topic.subscribedAt ? (
						<>
							<span className={classes.cardMetaSeparator} aria-hidden="true" />
							<span>
								{labels.card.subscribed(formatDate(topic.subscribedAt, locale))}
							</span>
						</>
					) : null}
				</div>
			</div>

			<Button
				className={classes.cardAction}
				size="sm"
				radius="sm"
				variant={danger ? "outline" : "filled"}
				color={danger ? "red" : undefined}
				loading={isPending}
				onClick={() => onAction(topic)}
			>
				{actionLabel}
			</Button>
		</li>
	);
}
