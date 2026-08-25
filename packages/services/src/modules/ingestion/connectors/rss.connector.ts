import { parseRssFeed } from "feedsmith";
import type { FeedItem } from "../connector.port.js";
import { FeedConnector } from "./feed.connector.js";

export class RssConnector extends FeedConnector {
	protected async parseItems(rss: string, label: string): Promise<FeedItem[]> {
		const parsed = await parseRssFeed(rss);
		if (!parsed?.items || !Array.isArray(parsed.items)) {
			this.parseError(rss, label, "Failed to parse RSS feed");
		}

		return parsed.items.map((item) => ({
			title: item.title,
			link: item.link,
			description: item.description,
			imageUrl: item.enclosures?.[0]?.url ?? null,
			// SPIP feeds — a large share of the independent French press — carry
			// no `pubDate` and date their items with Dublin Core instead.
			// `dc.dates` is the repeatable form; the singular `dc.date` that
			// feedsmith also exposes is deprecated.
			publishedAt: item.pubDate ?? item.dc?.dates?.[0],
		}));
	}
}
