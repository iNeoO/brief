import { BRAND_NAME } from "@brief/common/constants";
import type { Locale } from "#/libs/i18n/config";
import { absoluteUrl, siteOrigin } from "./site";

/**
 * Stable `@id`s, so the article on a brief page can point at the publisher and
 * the site instead of describing them again. A crawler resolves the reference
 * across the whole graph of the site, which is what keeps the brand one entity
 * rather than one per page.
 */
export const organizationId = () => `${siteOrigin()}/#organization`;
export const websiteId = () => `${siteOrigin()}/#website`;

/**
 * Sits on the root route, so every page carries it. Google keeps the first
 * definition it resolves and treats the rest as the same node.
 */
export const siteJsonLd = ({
	locale,
	description,
}: {
	locale: Locale;
	description: string;
}): Record<string, unknown> => ({
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "Organization",
			"@id": organizationId(),
			name: BRAND_NAME,
			url: absoluteUrl("/"),
			// A raster logo, at least 112px on its side: Google rejects an SVG here.
			logo: {
				"@type": "ImageObject",
				url: absoluteUrl("/icon-512.png"),
				width: 512,
				height: 512,
			},
		},
		{
			"@type": "WebSite",
			"@id": websiteId(),
			name: BRAND_NAME,
			url: absoluteUrl("/"),
			description,
			inLanguage: locale,
			publisher: { "@id": organizationId() },
		},
	],
});

/** Home › … › this page. The last crumb is the page itself, without a URL. */
export const breadcrumbJsonLd = (
	trail: Array<{ name: string; path?: string }>,
): Record<string, unknown> => ({
	"@context": "https://schema.org",
	"@type": "BreadcrumbList",
	itemListElement: trail.map((crumb, index) => ({
		"@type": "ListItem",
		position: index + 1,
		name: crumb.name,
		...(crumb.path ? { item: absoluteUrl(crumb.path) } : {}),
	})),
});
