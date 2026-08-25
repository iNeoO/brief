export type RawArticle = {
	url: string;
	title: string;
	description?: string | null;
	content: string;
	imageUrl?: string | null;
	publishedAt?: Date | null;
};

/**
 * One feed entry, normalised across feed formats so the shared hydration path
 * does not care whether it came from RSS or Atom.
 */
export type FeedItem = {
	title?: string;
	link?: string;
	description?: string | null;
	imageUrl?: string | null;
	publishedAt?: Date | string | null;
};

export type FetchLatestInput = {
	url: string;
	limit: number;
	label: string;
};

export interface ArticleConnector {
	fetchLatest(input: FetchLatestInput): Promise<RawArticle[]>;
}
