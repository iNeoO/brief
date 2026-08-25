import { parseAtomFeed } from "feedsmith";
import type { FeedItem } from "../connector.port.js";
import { FeedConnector } from "./feed.connector.js";

export class AtomConnector extends FeedConnector {
	protected async parseItems(atom: string, label: string): Promise<FeedItem[]> {
		let parsed: Awaited<ReturnType<typeof parseAtomFeed>>;
		try {
			parsed = await parseAtomFeed(atom);
		} catch {
			// Unlike its RSS counterpart, `parseAtomFeed` throws on a document it
			// cannot read rather than returning an empty feed.
			this.parseError(atom, label, "Failed to parse Atom feed");
		}

		if (!parsed?.entries || !Array.isArray(parsed.entries)) {
			this.parseError(atom, label, "Failed to parse Atom feed");
		}

		return parsed.entries.map((entry) => ({
			title: entry.title,
			// Atom carries a list of typed links; the readable page is the one
			// marked `alternate`.
			link:
				entry.links?.find((link) => link.rel === "alternate")?.href ??
				entry.links?.[0]?.href,
			description: entry.summary ?? entry.content,
			imageUrl:
				entry.links?.find((link) => link.rel === "enclosure")?.href ?? null,
			publishedAt: entry.published ?? entry.updated,
		}));
	}
}
