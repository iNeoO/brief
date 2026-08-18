import type { BriefScript } from "@brief/services";
import { Anchor, Button, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import classes from "#/components/briefs/briefs.module.css";
import { formatBriefDate } from "#/components/home/latest-briefs";
import { SiteShell } from "#/components/layout/site-shell";
import { ROUTES } from "#/config/routes";
import { briefAudioUrl, briefQueryOptions } from "#/libs/api/briefs";
import { useI18n } from "#/libs/i18n/context";
import { readStoredLocale } from "#/libs/i18n/locale-cookie";
import { localisedTitle } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/briefs/$id")({
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			briefQueryOptions(Number(params.id)),
		);

		return { locale: readStoredLocale() };
	},
	head: localisedTitle((d) => d.briefs.title),
	component: BriefPage,
});

function BriefPage() {
	const { id } = Route.useParams();
	const { locale, t } = useI18n();
	const brief = useQuery(briefQueryOptions(Number(id)));

	if (!brief.data) {
		return (
			<SiteShell>
				<div className={`brief-shell ${classes.page}`}>
					<div className={classes.notice}>
						<p className={classes.noticeTitle}>
							{brief.isError
								? t.briefs.loadError
								: t.briefs.detail.notFound.title}
						</p>
						{brief.isError ? null : (
							<p className={classes.noticeBody}>
								{t.briefs.detail.notFound.body}
							</p>
						)}
						<p>
							<Link to={ROUTES.briefs}>{t.briefs.detail.notFound.cta}</Link>
						</p>
					</div>
				</div>
			</SiteShell>
		);
	}

	const detail = brief.data;

	return (
		<SiteShell>
			<article className={`brief-shell ${classes.page}`}>
				<Link to={ROUTES.briefs} className={classes.backLink}>
					{t.briefs.detail.back}
				</Link>

				<header className={classes.header}>
					<div className={classes.itemMeta}>
						<span className={classes.topic}>{detail.categoryName}</span>
						<span className={classes.date}>
							{t.brief.readTime(detail.readingMinutes)}
						</span>
					</div>

					<Title order={1} className={classes.title}>
						{formatBriefDate(detail.targetDate, locale)}
					</Title>
					<p className={classes.lead}>{detail.categoryDescription}</p>
				</header>

				<Player audio={detail.audio} categoryName={detail.categoryName} />

				<Script script={detail.script} />

				{/* Only as a fallback: when the paragraphs line up with the sources,
				    every link already sits under the story it belongs to. */}
				{!detail.script.aligned && detail.sources.length > 0 ? (
					<section className={classes.sources}>
						<Title order={2} className={classes.sourcesTitle}>
							{t.briefs.detail.sourcesTitle}
						</Title>
						<p className={classes.sourcesLead}>{t.briefs.detail.sourcesLead}</p>

						<ul className={classes.sourceList}>
							{detail.sources.map((source) => (
								<li key={source.url} className={classes.sourceItem}>
									<Anchor
										href={source.url}
										target="_blank"
										rel="noreferrer noopener"
										aria-label={t.briefs.detail.sourceLabel(
											source.title,
											source.providerName,
										)}
									>
										{source.title}
									</Anchor>
									<span className={classes.sourceProvider}>
										{source.providerName}
									</span>
								</li>
							))}
						</ul>
					</section>
				) : null}
			</article>
		</SiteShell>
	);
}

/**
 * The script is plain prose by design — the writing prompt forbids markdown,
 * because the same text is read aloud. What it does guarantee is a shape:
 * an opening sentence, a paragraph of headlines, one paragraph per story, a
 * closing sentence. That shape is what gets styled here, with no formatting
 * pass and no second model call.
 */
function Script({ script }: { script: BriefScript }) {
	const { t } = useI18n();

	return (
		<div className={classes.script}>
			{script.opening ? <p className={classes.lede}>{script.opening}</p> : null}

			{script.headlines ? (
				<p className={classes.headlines}>{script.headlines}</p>
			) : null}

			{script.stories.map((story) => (
				<div key={story.paragraph.slice(0, 60)} className={classes.story}>
					<p className={classes.paragraph}>{story.paragraph}</p>

					{story.source ? (
						<span className={classes.storySource}>
							<Anchor
								href={story.source.url}
								target="_blank"
								rel="noreferrer noopener"
								aria-label={t.briefs.detail.sourceLabel(
									story.source.title,
									story.source.providerName,
								)}
							>
								{story.source.title}
							</Anchor>{" "}
							<span className={classes.storyProvider}>
								{story.source.providerName}
							</span>
						</span>
					) : null}
				</div>
			))}

			{script.closing ? (
				<p className={classes.closing}>{script.closing}</p>
			) : null}
		</div>
	);
}

function Player({
	audio,
	categoryName,
}: {
	audio: { id: string; size: number } | null;
	categoryName: string;
}) {
	const { t } = useI18n();

	return (
		<section id="listen" className={classes.player}>
			<p className={classes.playerTitle}>{t.briefs.detail.listenTitle}</p>

			{audio ? (
				<>
					{/* biome-ignore lint/a11y/useMediaCaption: the audio is a reading of
					    the script printed directly below it, which is the transcript. */}
					<audio
						className={classes.audio}
						controls
						preload="metadata"
						src={briefAudioUrl(audio.id)}
					/>

					<div className={classes.playerActions}>
						<Button
							component="a"
							href={briefAudioUrl(audio.id, true)}
							variant="default"
							size="sm"
							aria-label={t.briefs.detail.downloadLabel(categoryName)}
						>
							{t.briefs.detail.download}
						</Button>
					</div>
				</>
			) : (
				<p className={classes.noticeBody}>{t.briefs.detail.noAudio}</p>
			)}
		</section>
	);
}
