import {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
	INTERNAL_ERROR_CODE,
	JOB_STATUS,
} from "@brief/common/constants";
import { and, type Database, eq, inArray, schema } from "@brief/drizzle";
import { InternalError } from "@brief/infra/errors";
import type { PlanDailyRunCategory } from "./scheduler.type.js";

export class SchedulerService {
	constructor(private db: Database) {}

	async planDailyRun(categories: PlanDailyRunCategory[], targetDate: Date) {
		return await this.db.transaction(async (tx) => {
			const providerIds = [
				...new Set(
					categories.flatMap(({ providers }) => providers.map((p) => p.id)),
				),
			];

			const jobColumns = {
				id: schema.providerFetchJobs.id,
				providerId: schema.providerFetchJobs.providerId,
			};

			const newProviderFetchJobs = providerIds.length
				? await tx
						.insert(schema.providerFetchJobs)
						.values(
							providerIds.map((providerId) => ({
								providerId,
								targetDate,
								status: JOB_STATUS.PENDING,
							})),
						)
						.onConflictDoNothing({
							target: [
								schema.providerFetchJobs.providerId,
								schema.providerFetchJobs.targetDate,
							],
						})
						.returning(jobColumns)
				: [];

			// Re-read instead of merging the inserted rows with a per-provider fallback:
			// one query covers both the jobs we just created and the pre-existing ones.
			const providerFetchJobs = providerIds.length
				? await tx
						.select(jobColumns)
						.from(schema.providerFetchJobs)
						.where(
							and(
								eq(schema.providerFetchJobs.targetDate, targetDate),
								inArray(schema.providerFetchJobs.providerId, providerIds),
							),
						)
				: [];

			const providerFetchJobIdByProviderId = new Map(
				providerFetchJobs.map(
					({ providerId, id }) => [providerId, id] as const,
				),
			);

			for (const category of categories) {
				const [insertedJob] = await tx
					.insert(schema.categoryJobs)
					.values({
						categoryId: category.id,
						targetDate,
						status: CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS,
						state: CATEGORY_JOB_STATE.CREATING_REPORT,
					})
					.onConflictDoNothing({
						target: [
							schema.categoryJobs.categoryId,
							schema.categoryJobs.targetDate,
						],
					})
					.returning();

				let categoryJob = insertedJob;
				if (!categoryJob) {
					[categoryJob] = await tx
						.select()
						.from(schema.categoryJobs)
						.where(
							and(
								eq(schema.categoryJobs.categoryId, category.id),
								eq(schema.categoryJobs.targetDate, targetDate),
							),
						);
				}

				const dependencyRows = category.providers.map((provider) => {
					const providerFetchJobId = providerFetchJobIdByProviderId.get(
						provider.id,
					);

					if (providerFetchJobId === undefined) {
						throw new InternalError({
							code: INTERNAL_ERROR_CODE.SCHEDULER_MISSING_PROVIDER_FETCH_JOB,
							message: `No provider fetch job for provider ${provider.id} on ${targetDate.toISOString()} (category ${category.id})`,
						});
					}

					return { categoryJobId: categoryJob.id, providerFetchJobId };
				});

				if (dependencyRows.length > 0) {
					await tx
						.insert(schema.categoryJobProviderFetchJobs)
						.values(dependencyRows)
						.onConflictDoNothing({
							target: [
								schema.categoryJobProviderFetchJobs.categoryJobId,
								schema.categoryJobProviderFetchJobs.providerFetchJobId,
							],
						});
				}
			}

			return { newProviderFetchJobs };
		});
	}
}
