import { Button, Title, VisuallyHidden } from "@mantine/core";
import { ClockIcon, PlayIcon } from "#/components/icons";
import { ROUTES } from "#/config/routes";
import type { Locale } from "#/libs/i18n/config";
import { useI18n } from "#/libs/i18n/context";
import type { Dictionary } from "#/libs/i18n/dictionaries";
import classes from "./home.module.css";

export type BriefItem = Dictionary["brief"]["items"][number];

const formatBriefDate = (date: Date, locale: Locale) =>
	new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	}).format(date);

export function DailyBrief({
	date,
	items,
}: {
	date: Date;
	items: BriefItem[];
}) {
	const { locale, t } = useI18n();

	return (
		<section
			id="brief"
			className={`${classes.section} ${classes.sectionBordered}`}
		>
			<div className="brief-shell">
				<div className={classes.brief}>
					<div className={classes.briefHeader}>
						<Title order={2} className={classes.briefTitle}>
							{t.brief.title}
						</Title>
						<p className={classes.briefDate}>{formatBriefDate(date, locale)}</p>
					</div>

					{items.length === 0 ? (
						<UnpublishedNotice />
					) : (
						<>
							<ul className={classes.briefList}>
								{items.map((item) => (
									<BriefEntry key={item.headline} item={item} />
								))}
							</ul>

							<MoreTopicsNotice />
						</>
					)}
				</div>
			</div>
		</section>
	);
}

function BriefEntry({ item }: { item: BriefItem }) {
	const { t } = useI18n();

	return (
		<li className={classes.briefItem}>
			<div className={classes.briefMeta}>
				<span className={classes.briefTopic}>{item.topic}</span>
				<span className={classes.briefReadTime}>
					<ClockIcon />
					<span aria-hidden="true">{t.brief.readTime(item.minutes)}</span>
					{/* Screen readers get the unabbreviated duration. */}
					<VisuallyHidden>{t.brief.readTimeLabel(item.minutes)}</VisuallyHidden>
				</span>
			</div>

			<Title order={3} className={classes.briefHeadline}>
				{item.headline}
			</Title>

			<p className={classes.briefBody}>{item.body}</p>

			<div className={classes.briefActions}>
				<a href={ROUTES.signUp} className={classes.readLink}>
					{t.brief.read}
				</a>

				<Button
					component="a"
					href={ROUTES.signUp}
					variant="default"
					size="sm"
					radius="sm"
					leftSection={<PlayIcon size={14} />}
					aria-label={t.brief.listenLabel(item.headline)}
				>
					{t.brief.listen}
				</Button>
			</div>
		</li>
	);
}

function UnpublishedNotice() {
	const { t } = useI18n();

	return (
		<div className={classes.notice}>
			<p className={classes.noticeTitle}>{t.brief.unpublished.title}</p>
			<p className={classes.noticeBody}>{t.brief.unpublished.body}</p>
			<a href={ROUTES.signIn} className={classes.noticeLink}>
				{t.brief.unpublished.cta}
			</a>
		</div>
	);
}

function MoreTopicsNotice() {
	const { t } = useI18n();

	return (
		<div className={classes.notice}>
			<p className={classes.noticeBody}>{t.brief.moreTopics.body}</p>
			<a href={ROUTES.preferences} className={classes.noticeLink}>
				{t.brief.moreTopics.cta}
			</a>
		</div>
	);
}
