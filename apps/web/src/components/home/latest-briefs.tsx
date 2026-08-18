import type { BriefCard } from "@brief/services";
import { Title, VisuallyHidden } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { ClockIcon, PlayIcon } from "#/components/icons";
import { ROUTES } from "#/config/routes";
import type { Locale } from "#/libs/i18n/config";
import { useI18n } from "#/libs/i18n/context";
import classes from "./home.module.css";

export const formatBriefDate = (date: Date, locale: Locale) =>
	new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "long",
		year: "numeric",
		// The target date is a calendar day, stored without a time: reading it
		// in the visitor's zone would shift it by one day west of Greenwich.
		timeZone: "UTC",
	}).format(date);

export function LatestBriefs({
	briefs,
	failed = false,
}: {
	briefs: BriefCard[];
	failed?: boolean;
}) {
	const { t } = useI18n();

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
						<p className={classes.briefDate}>{t.brief.lead}</p>
					</div>

					{briefs.length === 0 ? (
						<EmptyNotice failed={failed} />
					) : (
						<>
							<ul className={classes.briefList}>
								{briefs.map((brief) => (
									<BriefEntry key={brief.id} brief={brief} />
								))}
							</ul>

							<p className={classes.noticeLink}>
								<Link to={ROUTES.briefs}>{t.brief.seeAll}</Link>
							</p>
						</>
					)}
				</div>
			</div>
		</section>
	);
}

function BriefEntry({ brief }: { brief: BriefCard }) {
	const { locale, t } = useI18n();

	return (
		<li className={classes.briefItem}>
			<div className={classes.briefMeta}>
				<span className={classes.briefTopic}>{brief.categoryName}</span>
				<span className={classes.briefReadTime}>
					<ClockIcon />
					<span aria-hidden="true">
						{t.brief.readTime(brief.readingMinutes)}
					</span>
					{/* Screen readers get the unabbreviated duration. */}
					<VisuallyHidden>
						{t.brief.readTimeLabel(brief.readingMinutes)}
					</VisuallyHidden>
				</span>
			</div>

			<Title order={3} className={classes.briefHeadline}>
				{formatBriefDate(brief.targetDate, locale)}
			</Title>

			<p className={classes.briefBody}>{brief.excerpt}</p>

			<div className={classes.briefActions}>
				<Link
					to={ROUTES.brief}
					params={{ id: String(brief.id) }}
					className={classes.readLink}
				>
					{t.brief.read}
				</Link>

				{/* Only when there is something to play: the audio step can fail on
				    its own and leave a perfectly readable brief behind. */}
				{brief.audioFileId ? (
					<Link
						to={ROUTES.brief}
						params={{ id: String(brief.id) }}
						hash="listen"
						className={classes.readLink}
						aria-label={t.brief.listenLabel(brief.categoryName)}
					>
						<PlayIcon size={14} />
						{t.brief.listen}
					</Link>
				) : null}
			</div>
		</li>
	);
}

function EmptyNotice({ failed }: { failed: boolean }) {
	const { t } = useI18n();

	return (
		<div className={classes.notice}>
			<p className={classes.noticeTitle}>
				{failed ? t.brief.loadError : t.brief.empty.title}
			</p>
			{failed ? null : (
				<p className={classes.noticeBody}>{t.brief.empty.body}</p>
			)}
		</div>
	);
}
