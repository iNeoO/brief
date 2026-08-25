import type { BriefCard } from "@brief/services";
import { Title, VisuallyHidden } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { ClockIcon, PlayIcon } from "#/components/icons";
import { Notice } from "#/components/notice";
import { ROUTES } from "#/config/routes";
import { formatCalendarDate } from "#/libs/format/date";
import { useI18n } from "#/libs/i18n/context";
import classes from "./home.module.css";

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
						<Notice
							className={classes.briefNotice}
							title={failed ? t.brief.loadError : t.brief.empty.title}
							body={failed ? undefined : t.brief.empty.body}
						/>
					) : (
						<>
							<ul className={classes.briefList}>
								{briefs.map((brief) => (
									<BriefEntry key={brief.id} brief={brief} />
								))}
							</ul>

							<p className={classes.sectionLink}>
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
				{formatCalendarDate(brief.targetDate, locale, "long")}
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
