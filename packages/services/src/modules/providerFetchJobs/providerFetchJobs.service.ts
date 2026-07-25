import { JOB_STATUS, MAX_JOB_RETRY } from "@brief/common/constants";
import { and, type Database, eq, isNull, schema } from "@brief/drizzle";
import type { CreateProviderFetchJobParams } from "./providerFetchJobs.type.js";

export class ProviderFetchJobsService {
	constructor(private db: Database) {}

	async createJob(params: CreateProviderFetchJobParams) {
		return await this.db
			.insert(schema.providerFetchJobs)
			.values({
				...params,
				status: "pending",
			})
			.onConflictDoNothing({
				target: [
					schema.providerFetchJobs.providerId,
					schema.providerFetchJobs.targetDate,
				],
			})
			.returning();
	}

	async claimJob(jobId: number) {
		return await this.db.transaction(async (tx) => {
			const [job] = await tx
				.update(schema.providerFetchJobs)
				.set({
					status: JOB_STATUS.RUNNING,
				})
				.where(
					and(
						eq(schema.providerFetchJobs.id, jobId),
						eq(schema.providerFetchJobs.status, JOB_STATUS.PENDING),
					),
				)
				.returning();

			if (!job) return undefined;

			const [provider] = await tx
				.select()
				.from(schema.providers)
				.where(eq(schema.providers.id, job.providerId));

			return {
				...job,
				provider,
			};
		});
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

	async markFinished(jobId: number) {
		return await this.db
			.update(schema.providerFetchJobs)
			.set({
				status: JOB_STATUS.FINISHED,
				error: null,
				retry: 0,
				finishedAt: new Date(),
			})
			.where(
				and(
					eq(schema.providerFetchJobs.id, jobId),
					eq(schema.providerFetchJobs.status, JOB_STATUS.RUNNING),
				),
			)
			.returning();
	}

	async incrementRetry(jobId: number, error: string) {
		return await this.db.transaction(async (tx) => {
			const [current] = await tx
				.select({ retry: schema.providerFetchJobs.retry })
				.from(schema.providerFetchJobs)
				.where(eq(schema.providerFetchJobs.id, jobId));

			if (!current) return null;

			const retry = current.retry + 1;
			const failed = retry >= MAX_JOB_RETRY;
			const status = failed ? JOB_STATUS.FAILED : JOB_STATUS.PENDING;

			const [job] = await tx
				.update(schema.providerFetchJobs)
				.set({ error, retry, status, finishedAt: failed ? new Date() : null })
				.where(eq(schema.providerFetchJobs.id, jobId))
				.returning();

			await tx.insert(schema.providerFetchJobEvents).values({
				providerFetchJobId: jobId,
				attempt: retry,
				status: JOB_STATUS.FAILED,
				error,
			});

			return job ?? null;
		});
	}
}
