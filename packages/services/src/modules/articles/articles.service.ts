import { and, type Database, gte, lt, schema } from "@brief/drizzle";
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

	getArticlesByDay(day: Date) {
		const start = new Date(day);
		start.setHours(0, 0, 0, 0);

		const end = new Date(start);
		end.setDate(end.getDate() + 1);

		return this.db
			.select()
			.from(schema.articles)
			.where(
				and(
					gte(schema.articles.publishedAt, start),
					lt(schema.articles.publishedAt, end),
				),
			);
	}
}
