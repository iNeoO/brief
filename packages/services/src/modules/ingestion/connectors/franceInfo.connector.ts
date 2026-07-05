import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";
import { parseRssFeed } from "feedsmith";
import { fetchText } from "../../../helpers/fetchText.helper.js";
import type { ArticleConnector } from "../connector.port.js";
import type { SlugConnectors } from "../ingestion.type.js";

export class FranceInfoConnector implements ArticleConnector {
	readonly slug: SlugConnectors = "france-info";

	async parse(rss: string, limit: number) {
		const parsed = await parseRssFeed(rss);
		if (!parsed?.items || !Array.isArray(parsed.items)) {
			const logger = getLoggerStore();
			logger.error({ rss }, "Failed to parse RSS feed");
			throw new InternalError({
				message: "Failed to parse RSS feed",
				code: "CONNECTOR_PARSE_ERROR",
			});
		}

		const items = parsed.items
			.filter((item) => item.link && item.title)
			.slice(0, limit);

		const articles = await Promise.all(
			items.map(async (item) => {
				const url = item.link as string;

				let content: string;
				try {
					content = await this.parseArticle(url);
				} catch (err) {
					const logger = getLoggerStore();
					logger.warn(
						{ err, url },
						"Skipping article, failed to fetch content",
					);
					return null;
				}

				return {
					url,
					title: item.title as string,
					description: item.description,
					content,
					imageUrl: item.enclosures?.[0]?.url ?? null,
					publishedAt: item.pubDate ? new Date(item.pubDate) : null,
				};
			}),
		);

		return articles.filter((article) => article !== null);
	}

	async parseArticle(url: string) {
		return fetchText({ url, context: "France Info article" });
	}

	async fetchLatest(input: { url: string; limit: number }) {
		const rss = await fetchText({
			url: input.url,
			context: "France Info feed",
		});
		return this.parse(rss, input.limit);
	}
}
