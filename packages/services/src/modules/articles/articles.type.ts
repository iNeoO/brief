export type CreateManyArticlesParams = {
	providerId: string;
	url: string;
	title: string;
	content: string;
	description: string | null;
	publishedAt: Date | null;
}[];
