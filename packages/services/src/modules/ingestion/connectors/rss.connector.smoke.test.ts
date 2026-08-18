import { SEED_PROVIDERS } from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import { RssConnector } from "./rss.connector.js";

// The media the seed installs: what runs in production is what is tested here.
const FEEDS = SEED_PROVIDERS.map(({ name, url }) => ({ label: name, url }));

describe.skipIf(!process.env.SMOKE)("RssConnector (network)", () => {
	it.each(FEEDS)("ingests real articles from $label", async ({
		label,
		url,
	}) => {
		const articles = await new RssConnector().fetchLatest({
			url,
			limit: 5,
			label,
		});

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
