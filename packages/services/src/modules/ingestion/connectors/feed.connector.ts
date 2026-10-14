import {
	MAX_ARTICLE_DESCRIPTION_CHARS,
	MAX_ARTICLE_TITLE_CHARS,
} from "@brief/common/constants";
import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";
import { clampText } from "../../../helpers/clampText.helper.js";
import { extractArticle } from "../../../helpers/extractArticle.helper.js";
import { fetchText } from "../../../helpers/fetchText.helper.js";
import type {
	ArticleConnector,
	FeedItem,
	FetchLatestInput,
	RawArticle,
} from "../connector.port.js";

/**
 * Everything a feed connector does once the document is parsed: pick the first
 * `limit` usable entries, fetch each article body, and drop the ones that fail.
 * Subclasses supply `parseItems` — the only part that knows the feed format.
 */
export abstract class FeedConnector implements ArticleConnector {
	async fetchLatest({ url, limit, label }: FetchLatestInput) {
		const feed = await fetchText({ url, context: `${label} feed` });
		return this.parse(feed, { limit, label });
	}

	/** Normalised entries, in feed order. Throws when the document is unusable. */
	protected abstract parseItems(
		feed: string,
		label: string,
	): Promise<FeedItem[]>;

	protected parseError(feed: string, label: string, message: string): never {
		getLoggerStore().error({ feed, label }, message);
		throw new InternalError({ message, code: "CONNECTOR_PARSE_ERROR" });
	}

	protected async parse(
		feed: string,
		{ limit, label }: { limit: number; label: string },
	): Promise<RawArticle[]> {
		const items = (await this.parseItems(feed, label))
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
					// The body already comes back clamped from `extractArticle`; the
					// title and the summary are the feed's own text, and a feed is free
					// to put a whole page in either of them.
					title: clampText(item.title as string, MAX_ARTICLE_TITLE_CHARS),
					description:
						item.description == null
							? item.description
							: clampText(item.description, MAX_ARTICLE_DESCRIPTION_CHARS),
					content,
					imageUrl: item.imageUrl ?? null,
					publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
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
