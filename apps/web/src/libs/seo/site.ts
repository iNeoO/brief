/**
 * The origin every absolute address on the site is built from.
 *
 * Read straight off `process.env` rather than through the validated `env`
 * object: this module is pulled into the client bundle by every route's `head`,
 * and the `import.meta.env.SSR` branch — which Vite replaces with a constant —
 * is what keeps the schema that parses the whole server environment out of it.
 * `SITE_URL` is still in that schema, so a missing value stops the server
 * instead of quietly emitting canonical URLs that point nowhere.
 */
export const siteOrigin = (): string =>
	import.meta.env.SSR
		? (process.env.SITE_URL ?? "").replace(/\/+$/, "")
		: window.location.origin;

/** `path` is absolute from the root, query string included where it matters. */
export const absoluteUrl = (path: string): string => `${siteOrigin()}${path}`;
