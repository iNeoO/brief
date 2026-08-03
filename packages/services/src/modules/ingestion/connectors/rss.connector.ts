import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";
import { parseRssFeed } from "feedsmith";
import { extractArticle } from "../../../helpers/extractArticle.helper.js";
import { fetchText } from "../../../helpers/fetchText.helper.js";
import type {
	ArticleConnector,
	FetchLatestInput,
	RawArticle,
} from "../connector.port.js";

export class RssConnector implements ArticleConnector {
	async fetchLatest({ url, limit, label }: FetchLatestInput) {
		const rss = await fetchText({ url, context: `${label} feed` });
		return this.parse(rss, { limit, label });
	}

	protected async parse(
		rss: string,
		{ limit, label }: { limit: number; label: string },
	): Promise<RawArticle[]> {
		const parsed = await parseRssFeed(rss);
		if (!parsed?.items || !Array.isArray(parsed.items)) {
			const logger = getLoggerStore();
			logger.error({ rss, label }, "Failed to parse RSS feed");
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
					content = await this.parseArticle(url, label);
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

	protected async parseArticle(url: string, label: string) {
		const html = await fetchText({ url, context: `${label} article` });
		return extractArticle(html, url);
	}
}
