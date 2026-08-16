import { asc, type Database, eq, schema } from "@brief/drizzle";

export class ProvidersService {
	constructor(private db: Database) {}

	/**
	 * Every provider, for the category form's picker. Unpaginated on purpose:
	 * providers are a short, hand-curated list.
	 */
	async listAll() {
		return await this.db
			.select({
				id: schema.providers.id,
				name: schema.providers.name,
				isEnabled: schema.providers.isEnabled,
			})
			.from(schema.providers)
			.orderBy(asc(schema.providers.name));
	}

	async touchLastFetchedAt(providerId: string) {
		const [updated] = await this.db
			.update(schema.providers)
			.set({ lastFetchedAt: new Date() })
			.where(eq(schema.providers.id, providerId))
			.returning();

		return updated;
	}
}
