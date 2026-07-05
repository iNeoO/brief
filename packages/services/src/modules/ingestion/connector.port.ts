import type { SlugConnectors } from "./ingestion.type.js";

export type RawArticle = {
	url: string;
	title: string;
	description?: string | null;
	content: string;
	imageUrl?: string | null;
	publishedAt?: Date | null;
};

export interface ArticleConnector {
	slug: SlugConnectors;
	fetchLatest(input: { url: string; limit: number }): Promise<RawArticle[]>;
}
