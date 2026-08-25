import { createFileRoute } from "@tanstack/react-router";
import { ROUTES } from "#/config/routes";
import { absoluteUrl } from "#/libs/seo/site";

/**
 * Paths a crawler has no reason to fetch. Every one of them either sits behind
 * a session — where a crawler is redirected to the sign-in page anyway — or is
 * an endpoint rather than a page, so keeping them out is about crawl budget,
 * not about secrecy.
 *
 * The pages a crawler *can* reach but should not index — sign-in, and the
 * one-shot links from an email — are handled by a `noindex` in their own head
 * instead: a disallowed page is never fetched, so its `noindex` is never read,
 * and one that is already indexed would stay that way.
 */
const DISALLOWED = [
	ROUTES.home,
	ROUTES.profile,
	ROUTES.topics,
	ROUTES.admin,
	"/api/",
];

/**
 * The one endpoint that serves content rather than plumbing: it is what the
 * `AudioObject` of a brief points at, and a crawler that cannot fetch it cannot
 * confirm the structured data. Googlebot resolves the longest matching rule, so
 * this wins over the `/api/` line above.
 */
const ALLOWED = ["/api/briefs/audio/"];

export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: () => {
				const body = [
					"User-agent: *",
					"Allow: /",
					...DISALLOWED.map((path) => `Disallow: ${path}`),
					...ALLOWED.map((path) => `Allow: ${path}`),
					"",
					`Sitemap: ${absoluteUrl("/sitemap.xml")}`,
					"",
				].join("\n");

				return new Response(body, {
					headers: {
						"Content-Type": "text/plain; charset=utf-8",
						"Cache-Control": "public, max-age=3600",
					},
				});
			},
		},
	},
});
