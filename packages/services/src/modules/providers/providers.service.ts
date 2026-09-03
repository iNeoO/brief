import { type Database, eq, schema } from "@brief/drizzle";

export class ProvidersService {
	constructor(private db: Database) {}

	async touchLastFetchedAt(providerId: string) {
		const [updated] = await this.db
			.update(schema.providers)
			.set({ lastFetchedAt: new Date() })
			.where(eq(schema.providers.id, providerId))
			.returning();

		return updated;
	}
}
