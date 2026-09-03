export type RawArticle = {
	url: string;
	title: string;
	description?: string | null;
	content: string;
	imageUrl?: string | null;
	publishedAt?: Date | null;
};

export type FetchLatestInput = {
	url: string;
	limit: number;
	label: string;
};

export interface ArticleConnector {
	fetchLatest(input: FetchLatestInput): Promise<RawArticle[]>;
}
