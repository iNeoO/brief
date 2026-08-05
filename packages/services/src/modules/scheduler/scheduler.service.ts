import {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
	JOB_STATUS,
} from "@brief/common/constants";
import { and, type Database, eq, schema } from "@brief/drizzle";
import type { PlanDailyRunCategory } from "./scheduler.type.js";

export class SchedulerService {
	constructor(private db: Database) {}

	/**
	 * Creates the category jobs, provider fetch jobs, and the immutable
	 * dependency snapshot between them, all in one transaction — later changes
	 * to a category's providers must not change an already-planned job's
	 * dependencies.
	 */
	async planDailyRun(categories: PlanDailyRunCategory[], targetDate: Date) {
		return await this.db.transaction(async (tx) => {
			const newProviderFetchJobs: { id: number; providerId: string }[] = [];
			const providerFetchJobIdByProviderId = new Map<string, number>();

			const providerIds = [
				...new Set(
					categories.flatMap(({ providers }) => providers.map((p) => p.id)),
				),
			];

			for (const providerId of providerIds) {
				const [inserted] = await tx
					.insert(schema.providerFetchJobs)
					.values({ providerId, targetDate, status: JOB_STATUS.PENDING })
					.onConflictDoNothing({
						target: [
							schema.providerFetchJobs.providerId,
							schema.providerFetchJobs.targetDate,
						],
					})
					.returning();

				let job = inserted;
				if (job) {
					newProviderFetchJobs.push({ id: job.id, providerId });
				} else {
					[job] = await tx
						.select()
						.from(schema.providerFetchJobs)
						.where(
							and(
								eq(schema.providerFetchJobs.providerId, providerId),
								eq(schema.providerFetchJobs.targetDate, targetDate),
							),
						);
				}

				// biome-ignore lint/style/noNonNullAssertion: just inserted or selected above
				providerFetchJobIdByProviderId.set(providerId, job!.id);
			}

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

				const dependencyRows = category.providers.map((provider) => ({
					categoryJobId: categoryJob.id,
					// biome-ignore lint/style/noNonNullAssertion: populated above for every provider referenced by a category
					providerFetchJobId: providerFetchJobIdByProviderId.get(provider.id)!,
				}));

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
