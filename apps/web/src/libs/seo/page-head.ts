import { BRAND_NAME } from "@brief/common/constants";
import type { Locale } from "#/libs/i18n/config";
import { absoluteUrl } from "./site";

/** What Open Graph wants where `<html lang>` says `en` or `fr`. */
const OG_LOCALES: Record<Locale, string> = { en: "en_US", fr: "fr_FR" };

/**
 * One card per locale, so a link shared from the French site does not preview
 * in English. Both live in `public/`.
 */
const OG_IMAGES: Record<Locale, string> = {
	en: "/og-en.png",
	fr: "/og-fr.png",
};

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

/**
 * Google renders roughly 155 characters of a description and cuts the rest
 * mid-word; `truncateForMeta` cuts on a space instead.
 */
export const DESCRIPTION_MAX_LENGTH = 155;

/** Google ignores a `headline` past 110 characters in structured data. */
export const HEADLINE_MAX_LENGTH = 110;

export const truncateForMeta = (
	text: string,
	max = DESCRIPTION_MAX_LENGTH,
): string => {
	const collapsed = text.replace(/\s+/g, " ").trim();

	if (collapsed.length <= max) return collapsed;

	const cut = collapsed.slice(0, max - 1);
	const lastSpace = cut.lastIndexOf(" ");

	return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.…-]+$/, "")}…`;
};

/**
 * Structured data as head scripts. `<` becomes `\u003c` so a URL or a headline
 * carrying `</script` cannot close the block early; the result is still valid
 * JSON, which HTML-escaping the whole string would not be — the content of a
 * `<script>` is raw text, and an entity in it would reach the parser literally.
 */
export const jsonLdScripts = (entries: Array<Record<string, unknown>>) =>
	entries.map((entry) => ({
		type: "application/ld+json",
		children: JSON.stringify(entry).replace(/</g, "\\u003c"),
	}));

/** The absolute address of the locale's social card. */
export const ogImageUrl = (locale: Locale) => absoluteUrl(OG_IMAGES[locale]);

/**
 * What the root route contributes: the parts of the head that are the same on
 * every page, plus a fallback title and description for a route with no `head`
 * of its own.
 *
 * `robots` defaults to `noindex` here on purpose. The root is the shell, not a
 * page — the 404 renders through it, and so would any route added later without
 * SEO metadata. Every page that should be found calls `pageHead`, which
 * overrides this: meta tags are deduplicated by `name`/`property` with the
 * deepest match winning.
 */
export const siteDefaultsHead = ({
	title,
	description,
	locale,
}: {
	title: string;
	description: string;
	locale: Locale;
}) => {
	const documentTitle = `${BRAND_NAME} — ${title}`;
	const image = ogImageUrl(locale);

	return [
		{ title: documentTitle },
		{ name: "description", content: description },
		{ name: "robots", content: "noindex, nofollow" },
		{ property: "og:type", content: "website" },
		{ property: "og:site_name", content: BRAND_NAME },
		{ property: "og:title", content: documentTitle },
		{ property: "og:description", content: description },
		{ property: "og:locale", content: OG_LOCALES[locale] },
		{ property: "og:image", content: image },
		{ property: "og:image:width", content: String(OG_IMAGE_WIDTH) },
		{ property: "og:image:height", content: String(OG_IMAGE_HEIGHT) },
		{ property: "og:image:alt", content: documentTitle },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: documentTitle },
		{ name: "twitter:description", content: description },
		{ name: "twitter:image", content: image },
	];
};

export type PageHeadInput = {
	/** The page's own name; the brand is appended here, not by the caller. */
	title: string;
	/** Omitted on a `noindex` page, where nothing reads it. */
	description?: string;
	/** Canonical path from the root, query string included where it matters. */
	path: string;
	locale: Locale;
	/** The landing page leads with the brand; every other page trails it. */
	brandFirst?: boolean;
	type?: "website" | "article";
	/**
	 * Keeps the page out of the index. Nothing behind a session is worth a
	 * search result, and a reset-password address is worth even less.
	 */
	noindex?: boolean;
	/** ISO 8601, on an article. */
	publishedTime?: string;
	modifiedTime?: string;
	/** Rendered as-is into `<script type="application/ld+json">`. */
	jsonLd?: Array<Record<string, unknown>>;
};

/**
 * The head of one page: title, description, canonical, and the Open Graph and
 * Twitter pairs that decide what a shared link looks like.
 *
 * The canonical link is deliberately absent from the root route and emitted
 * here instead. Meta tags are deduplicated by `name`/`property`, so the deepest
 * match wins and a page can override the site defaults; links are not, so a
 * canonical on the root would sit next to every page's own and leave a crawler
 * with two of them.
 */
export const pageHead = ({
	title,
	description,
	path,
	locale,
	brandFirst = false,
	type = "website",
	noindex = false,
	publishedTime,
	modifiedTime,
	jsonLd = [],
}: PageHeadInput) => {
	const documentTitle = brandFirst
		? `${BRAND_NAME} — ${title}`
		: `${title} — ${BRAND_NAME}`;

	const url = absoluteUrl(path);
	const image = absoluteUrl(OG_IMAGES[locale]);

	return {
		meta: [
			{ title: documentTitle },
			...(description
				? [
						{ name: "description", content: description },
						{ property: "og:description", content: description },
						{ name: "twitter:description", content: description },
					]
				: []),
			{
				name: "robots",
				// `max-image-preview:large` is what lets a brief show a full-width
				// card in Discover and in the news carousels rather than a thumbnail.
				content: noindex
					? "noindex, nofollow"
					: "index, follow, max-image-preview:large, max-snippet:-1",
			},
			{ property: "og:type", content: type },
			{ property: "og:site_name", content: BRAND_NAME },
			{ property: "og:title", content: documentTitle },
			{ property: "og:url", content: url },
			{ property: "og:locale", content: OG_LOCALES[locale] },
			{ property: "og:image", content: image },
			{ property: "og:image:width", content: String(OG_IMAGE_WIDTH) },
			{ property: "og:image:height", content: String(OG_IMAGE_HEIGHT) },
			{ property: "og:image:alt", content: documentTitle },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: documentTitle },
			{ name: "twitter:image", content: image },
			...(publishedTime
				? [{ property: "article:published_time", content: publishedTime }]
				: []),
			...(modifiedTime
				? [{ property: "article:modified_time", content: modifiedTime }]
				: []),
		],
		scripts: jsonLdScripts(jsonLd),
		// A page nobody should index has nothing to point a canonical at, and
		// leaving it out is what keeps a parent route and its child from emitting
		// one each.
		links: noindex ? [] : [{ rel: "canonical", href: url }],
	};
};
