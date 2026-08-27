import { SIGNUP_ENABLED } from "@brief/common/constants";
import { createFileRoute } from "@tanstack/react-router";
import { ROUTES } from "#/config/routes";
import { absoluteUrl } from "#/libs/seo/site";
import { getContainer } from "#/libs/server/container";

/**
 * The pages that exist whatever the database holds. `changefreq` is left out on
 * purpose — Google has ignored it for years — and so is `priority`, which only
 * ever ranks a site's URLs against each other.
 */
const STATIC_PATHS = [
	ROUTES.landing,
	ROUTES.briefs,
	ROUTES.howItWorks,
	// Dropped while sign-up is closed: the page answers, but it is a notice
	// rather than the form a crawler would be indexing it for.
	...(SIGNUP_ENABLED ? [ROUTES.signUp] : []),
];

/** `&`, `<` and `>` are the three that make a sitemap unparseable. */
const escapeXml = (value: string) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");

const urlEntry = ({ path, lastmod }: { path: string; lastmod?: Date }) =>
	[
		"\t<url>",
		`\t\t<loc>${escapeXml(absoluteUrl(path))}</loc>`,
		...(lastmod
			? [`\t\t<lastmod>${new Date(lastmod).toISOString()}</lastmod>`]
			: []),
		"\t</url>",
	].join("\n");

/**
 * Built on every request rather than at deploy time: a brief a morning run
 * published an hour ago has to be in it, and the query reads two columns per
 * row. The cache header is what keeps a crawler from rebuilding it in a loop.
 */
export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				const container = getContainer();
				const briefs = await container.briefsService.listSitemapEntries();

				const body = [
					'<?xml version="1.0" encoding="UTF-8"?>',
					'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
					...STATIC_PATHS.map((path) => urlEntry({ path })),
					...briefs.map((brief) =>
						urlEntry({
							path: `${ROUTES.briefs}/${brief.id}`,
							lastmod: brief.updatedAt,
						}),
					),
					"</urlset>",
					"",
				].join("\n");

				return new Response(body, {
					headers: {
						"Content-Type": "application/xml; charset=utf-8",
						"Cache-Control": "public, max-age=3600",
					},
				});
			},
		},
	},
});
