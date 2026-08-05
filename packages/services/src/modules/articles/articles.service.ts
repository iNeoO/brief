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

	/**
	 * Resolves every article matching these URLs for the provider, whether
	 * freshly inserted or already known — used right after `createManyArticles`
	 * to get the full set of articles "observed" during a fetch, since
	 * `onConflictDoNothing` only returns the newly inserted rows.
	 */
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

	/**
	 * Candidate articles for a category job, following the immutable fetch
	 * snapshot (`category_job_provider_fetch_jobs` -> `provider_fetch_job_articles`)
	 * instead of a live `publishedAt` scan.
	 */
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
