import { JOB_STATUS, MAX_JOB_RETRY } from "@brief/common/constants";
import { and, type Database, eq, schema } from "@brief/drizzle";

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
				.where(
					and(
						eq(schema.providerFetchJobs.id, jobId),
						eq(schema.providerFetchJobs.status, JOB_STATUS.RUNNING),
					),
				)
				.returning();

			if (!job) return null;

			await tx.insert(schema.providerFetchJobEvents).values({
				providerFetchJobId: jobId,
				attempt: retry,
				status: JOB_STATUS.FAILED,
				error,
			});

			return job;
		});
	}
}
