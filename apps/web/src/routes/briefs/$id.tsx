import type { Language } from "@brief/common/types";
import type { BriefDetail, BriefScript } from "@brief/services";
import { Anchor, Button, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import classes from "#/components/briefs/briefs.module.css";
import { SiteShell } from "#/components/layout/site-shell";
import { Notice } from "#/components/notice";
import { ROUTES } from "#/config/routes";
import { briefAudioUrl, briefQueryOptions } from "#/libs/api/briefs";
import { formatCalendarDate } from "#/libs/format/date";
import { useI18n } from "#/libs/i18n/context";
import { readStoredLocale } from "#/libs/i18n/locale-cookie";
import { headDictionary } from "#/libs/i18n/route-head";
import {
	breadcrumbJsonLd,
	organizationId,
	websiteId,
} from "#/libs/seo/json-ld";
import {
	HEADLINE_MAX_LENGTH,
	pageHead,
	truncateForMeta,
} from "#/libs/seo/page-head";
import { absoluteUrl } from "#/libs/seo/site";

export const Route = createFileRoute("/briefs/$id")({
	loader: async ({ context, params }) => {
		const brief = await context.queryClient.ensureQueryData(
			briefQueryOptions(Number(params.id)),
		);

		return { locale: readStoredLocale(), brief };
	},
	head: ({ loaderData, params }) => {
		const { locale, t } = headDictionary(loaderData);
		const brief = loaderData?.brief;
		const path = `${ROUTES.briefs}/${params.id}`;

		// An id nobody published still renders a page, with the notice below. It
		// must not be indexed: a search result promising a brief that does not
		// exist is what Google counts as a soft 404.
		if (!brief) {
			return pageHead({
				title: t.briefs.detail.notFound.title,
				path,
				locale,
				noindex: true,
			});
		}

		const date = formatCalendarDate(brief.targetDate, locale, "long");
		const title = t.seo.brief.title(brief.categoryName, date);
		const publishedAt = new Date(brief.publishedAt).toISOString();
		// The opening sentence is written to stand alone, which is exactly what a
		// search result needs. The first story carries it when a single-story brief
		// has no opening, and the generic line is the last resort.
		const description = truncateForMeta(
			brief.script.opening ??
				brief.script.stories[0]?.paragraph ??
				t.seo.brief.description(brief.categoryName, date),
		);

		return pageHead({
			title,
			description,
			path,
			locale,
			type: "article",
			publishedTime: publishedAt,
			modifiedTime: publishedAt,
			jsonLd: [
				briefJsonLd({ brief, path, title, description, publishedAt }),
				breadcrumbJsonLd([
					{ name: t.a11y.homeLink, path: ROUTES.landing },
					{ name: t.seo.briefs.title, path: ROUTES.briefs },
					{ name: title },
				]),
			],
		});
	},
	component: BriefPage,
});

/**
 * The brief as a `NewsArticle`. Author and publisher are references into the
 * graph the root route lays down, rather than a second description of the
 * brand: a crawler resolves them site-wide, and repeating them per page is how
 * one publisher turns into hundreds.
 */
const briefJsonLd = ({
	brief,
	path,
	title,
	description,
	publishedAt,
}: {
	brief: BriefDetail;
	path: string;
	title: string;
	description: string;
	publishedAt: string;
}): Record<string, unknown> => {
	const url = absoluteUrl(path);

	return {
		"@context": "https://schema.org",
		"@type": "NewsArticle",
		"@id": `${url}#article`,
		url,
		headline: truncateForMeta(title, HEADLINE_MAX_LENGTH),
		description,
		datePublished: publishedAt,
		// A replay rewrites the script behind the same address, and `finishedAt`
		// moves with it, so the two dates are the same value by construction.
		dateModified: publishedAt,
		articleSection: brief.categoryName,
		// The brief's own language, not the reader's: the script is written in the
		// language of its topic whatever the site is set to.
		inLanguage: brief.language,
		timeRequired: `PT${brief.readingMinutes}M`,
		mainEntityOfPage: { "@type": "WebPage", "@id": url },
		isPartOf: { "@id": websiteId() },
		publisher: { "@id": organizationId() },
		author: { "@id": organizationId() },
		...(brief.sources.length > 0
			? {
					citation: brief.sources.map((source) => ({
						"@type": "CreativeWork",
						name: source.title,
						url: source.url,
						...(source.providerName
							? {
									publisher: {
										"@type": "Organization",
										name: source.providerName,
									},
								}
							: {}),
					})),
				}
			: {}),
		...(brief.audio
			? {
					associatedMedia: {
						"@type": "AudioObject",
						contentUrl: absoluteUrl(briefAudioUrl(brief.audio.id)),
						encodingFormat: brief.audio.mimeType,
						contentSize: String(brief.audio.size),
					},
				}
			: {}),
	};
};

/** `targetDate` is a calendar day, so `datetime` carries the day and no clock. */
const toIsoDay = (date: Date) => new Date(date).toISOString().slice(0, 10);

function BriefPage() {
	const { id } = Route.useParams();
	const { locale, t } = useI18n();
	const brief = useQuery(briefQueryOptions(Number(id)));

	if (!brief.data) {
		return (
			<SiteShell>
				<div className={`brief-shell ${classes.page}`}>
					<Notice
						title={
							brief.isError
								? t.briefs.loadError
								: t.briefs.detail.notFound.title
						}
						body={brief.isError ? undefined : t.briefs.detail.notFound.body}
					>
						<Link to={ROUTES.briefs}>{t.briefs.detail.notFound.cta}</Link>
					</Notice>
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
						<span className={classes.date}>
							{t.brief.readTime(detail.readingMinutes)}
						</span>
					</div>

					{/*
					 * The topic belongs in the heading, not only in the chip above it:
					 * a date on its own says nothing about what the page is, to a
					 * reader scanning tabs or to a crawler reading the outline.
					 */}
					<Title order={1} className={classes.title}>
						{detail.categoryName}
						<span className={classes.titleDate}>
							<time dateTime={toIsoDay(detail.targetDate)}>
								{formatCalendarDate(detail.targetDate, locale, "long")}
							</time>
						</span>
					</Title>
					<p className={classes.lead}>{detail.categoryDescription}</p>
				</header>

				<Player audio={detail.audio} categoryName={detail.categoryName} />

				<Script script={detail.script} language={detail.language} />

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
function Script({
	script,
	language,
}: {
	script: BriefScript;
	/*
	 * The topic's language, not the reader's: the script is written in the
	 * language of its category whatever the site chrome is set to, and a screen
	 * reader or a translation tool needs to be told where the switch happens.
	 */
	language: Language;
}) {
	const { t } = useI18n();

	return (
		<div className={classes.script} lang={language}>
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
			<h2 className={classes.playerTitle}>{t.briefs.detail.listenTitle}</h2>

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
				<p className={classes.noAudio}>{t.briefs.detail.noAudio}</p>
			)}
		</section>
	);
}
