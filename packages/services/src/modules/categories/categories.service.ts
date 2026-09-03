import type { Database } from "@brief/drizzle";

export class CategoriesService {
	constructor(private db: Database) {}

	async getCategories({ isEnable }: { isEnable?: boolean }) {
		return await this.db.query.categories.findMany({
			where: {
				isEnable: isEnable,
			},
			with: {
				providers: true,
			},
		});
	}
}
