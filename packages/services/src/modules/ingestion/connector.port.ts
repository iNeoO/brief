export type RawArticle = {
	url: string;
	title: string;
	description?: string | null;
	content: string;
	imageUrl?: string | null;
	publishedAt?: Date | null;
};

export interface ArticleConnector {
	slug: string;
	fetchLatest(input: { url: string; limit: number }): Promise<RawArticle[]>;
}
