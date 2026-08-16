import { and, type Database, eq, inArray, schema } from "@brief/drizzle";
import type { CreateManyArticlesParams } from "./articles.type.js";

export class ArticlesService {
	constructor(private db: Database) {}

	async createManyArticles(payload: CreateManyArticlesParams) {
		if (payload.length === 0) return [];

		return await this.db
			.insert(schema.articles)
			.values(payload)
			.onConflictDoNothing({
				target: [schema.articles.providerId, schema.articles.url],
			})
			.returning();
	}

	findByProviderAndUrls(providerId: string, urls: string[]) {
		if (urls.length === 0) return Promise.resolve([]);

		return this.db
			.select({ id: schema.articles.id })
			.from(schema.articles)
			.where(
				and(
					eq(schema.articles.providerId, providerId),
					inArray(schema.articles.url, urls),
				),
			);
	}

	getObservedArticles(categoryJobId: number) {
		return this.db
			.select({
				id: schema.articles.id,
				providerId: schema.articles.providerId,
				title: schema.articles.title,
				description: schema.articles.description,
				publishedAt: schema.articles.publishedAt,
			})
			.from(schema.categoryJobProviderFetchJobs)
			.innerJoin(
				schema.providerFetchJobArticles,
				eq(
					schema.providerFetchJobArticles.providerFetchJobId,
					schema.categoryJobProviderFetchJobs.providerFetchJobId,
				),
			)
			.innerJoin(
				schema.articles,
				eq(schema.articles.id, schema.providerFetchJobArticles.articleId),
			)
			.where(
				eq(schema.categoryJobProviderFetchJobs.categoryJobId, categoryJobId),
			);
	}

	getArticle(id: string) {
		return this.db.query.articles.findFirst({ where: { id } });
	}
}
