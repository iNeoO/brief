import { SEED_PROVIDERS } from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import { getConnector } from "../connector.registry.js";

// The media the seed installs, each through the connector its kind resolves to:
// what runs in production is what is tested here.
const FEEDS = SEED_PROVIDERS.map(({ name, slug, url, kind }) => ({
	label: name,
	slug,
	url,
	kind,
}));

describe.skipIf(!process.env.SMOKE)("connectors (network)", () => {
	it.each(FEEDS)("ingests real articles from $label", async ({
		label,
		slug,
		url,
		kind,
	}) => {
		const connector = getConnector({ slug, kind });
		if (!connector) {
			throw new Error(`No connector for kind "${kind}" (provider "${slug}")`);
		}

		const articles = await connector.fetchLatest({ url, limit: 5, label });

		expect(articles.length).toBeGreaterThan(0);
		expect(articles.length).toBeLessThanOrEqual(5);

		for (const article of articles) {
			expect(article.url.startsWith("http")).toBe(true);
			expect(article.title.length).toBeGreaterThan(0);
			expect(article.content.length).toBeGreaterThan(0);
			expect(article.publishedAt).toBeInstanceOf(Date);
		}
	}, 60_000);
});
