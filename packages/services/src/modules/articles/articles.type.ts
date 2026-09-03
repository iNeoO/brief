export type CreateManyArticlesParams = {
	providerId: number;
	url: string;
	title: string;
	content: string;
	description: string | null;
	publishedAt: Date | null;
}[];
