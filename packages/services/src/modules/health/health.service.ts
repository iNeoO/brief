import { type Database, sql } from "@brief/drizzle";
import { getLoggerStore } from "@brief/infra/libs";

export class HealthService {
	constructor(private db: Database) {}

	async getDbHealth(): Promise<"OK" | "NOT OK"> {
		try {
			await this.db.execute(sql`SELECT 1`);
			return "OK";
		} catch (err) {
			const logger = getLoggerStore();
			logger.error({ err });
			return "NOT OK";
		}
	}

	async getHealth() {
		const db = await this.getDbHealth();
		return { db };
	}
}
