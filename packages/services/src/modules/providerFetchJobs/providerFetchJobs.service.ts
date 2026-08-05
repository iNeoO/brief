import { JOB_STATUS, MAX_JOB_RETRY } from "@brief/common/constants";
import { and, type Database, eq, ne, schema } from "@brief/drizzle";

export class ProviderFetchJobsService {
	constructor(private db: Database) {}

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

	/**
	 * Walks the immutable dependency snapshot for this category job
	 * (`category_job_provider_fetch_jobs`), not the live `category_providers`
	 * table — a provider added or removed after the job was planned must not
	 * change what it's waiting on.
	 */
	async areAllProvidersFinished(categoryJobId: number) {
		const unfinished = await this.db
			.select({ id: schema.categoryJobProviderFetchJobs.providerFetchJobId })
			.from(schema.categoryJobProviderFetchJobs)
			.innerJoin(
				schema.providerFetchJobs,
				eq(
					schema.providerFetchJobs.id,
					schema.categoryJobProviderFetchJobs.providerFetchJobId,
				),
			)
			.where(
				and(
					eq(schema.categoryJobProviderFetchJobs.categoryJobId, categoryJobId),
					ne(schema.providerFetchJobs.status, JOB_STATUS.FINISHED),
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
