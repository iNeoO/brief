import { describe, expect, it } from "vitest";
import { RssConnector } from "./rss.connector.js";

const FEEDS = [
	{ label: "France Info", url: "https://www.franceinfo.fr/titres.rss" },
	{ label: "France 24", url: "https://www.france24.com/fr/france/rss" },
	{ label: "Huffpost", url: "https://www.huffingtonpost.fr/rss/all_full.xml" },
	{ label: "RFI", url: "https://www.rfi.fr/fr/france/rss" },
	{ label: "20 Minutes", url: "https://www.20minutes.fr/feeds/rss-une.xml" },
];

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
