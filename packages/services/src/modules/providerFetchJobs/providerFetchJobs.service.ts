import { JOB_STATUS } from "@brief/common/constants";
import { and, type Database, eq, isNull, schema } from "@brief/drizzle";
import type { CreateProviderFetchJobParams } from "./providerFetchJobs.type.js";

export class ProviderFetchJobsService {
	constructor(private db: Database) {}

	async createJob(params: CreateProviderFetchJobParams) {
		return await this.db
			.insert(schema.providerFetchJobs)
			.values(params)
			.onConflictDoNothing({
				target: [
					schema.providerFetchJobs.providerId,
					schema.providerFetchJobs.targetDate,
				],
			})
			.returning();
	}

	async areAllProvidersFinished(categoryId: string, targetDate: Date) {
		const unfinished = await this.db
			.select({ providerId: schema.categoryProviders.providerId })
			.from(schema.categoryProviders)
			.innerJoin(
				schema.providers,
				eq(schema.providers.id, schema.categoryProviders.providerId),
			)
			.leftJoin(
				schema.providerFetchJobs,
				and(
					eq(
						schema.providerFetchJobs.providerId,
						schema.categoryProviders.providerId,
					),
					eq(schema.providerFetchJobs.targetDate, targetDate),
					eq(schema.providerFetchJobs.status, JOB_STATUS.FINISHED),
				),
			)
			.where(
				and(
					eq(schema.categoryProviders.categoryId, categoryId),
					eq(schema.providers.isEnabled, true),
					isNull(schema.providerFetchJobs.id),
				),
			)
			.limit(1);

		return unfinished.length === 0;
	}
}
