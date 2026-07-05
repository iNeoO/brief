import { describe, expect, it } from "vitest";
import { FranceInfoConnector } from "./franceInfo.connector.js";

describe("FranceInfoConnector", () => {
	it("fetches and parses real articles from the France Info RSS feed", async () => {
		const connector = new FranceInfoConnector();

		const articles = await connector.fetchLatest({
			url: "https://www.franceinfo.fr/titres.rss",
			limit: 5,
		});

		expect(articles.length).toBeGreaterThan(0);
		expect(articles.length).toBeLessThanOrEqual(5);

		for (const article of articles) {
			expect(typeof article.url).toBe("string");
			expect(article.url.startsWith("http")).toBe(true);
			expect(typeof article.title).toBe("string");
			expect(article.title.length).toBeGreaterThan(0);
			expect(article.publishedAt).toBeInstanceOf(Date);
			expect(typeof article.content).toBe("string");
			expect(article.content.length).toBeGreaterThan(0);
		}
	});
});
