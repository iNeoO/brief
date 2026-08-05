import {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
	INTERNAL_ERROR_CODE,
	JOB_STATUS,
	MAX_JOB_RETRY,
} from "@brief/common/constants";
import type { CategoryJobState } from "@brief/common/types";
import { and, type Database, eq, schema } from "@brief/drizzle";
import { InternalError } from "@brief/infra/errors";

export class CategoryJobsService {
	constructor(private db: Database) {}

	async claimJob(jobId: number) {
		return await this.db.transaction(async (tx) => {
			const [job] = await tx
				.update(schema.categoryJobs)
				.set({
					status: JOB_STATUS.RUNNING,
				})
				.where(
					and(
						eq(schema.categoryJobs.id, jobId),
						eq(schema.categoryJobs.status, JOB_STATUS.PENDING),
					),
				)
				.returning();

			if (!job) return undefined;

			const categoryRows = await tx
				.select({
					category: schema.categories,
					provider: schema.providers,
				})
				.from(schema.categories)
				.leftJoin(
					schema.categoryProviders,
					eq(schema.categoryProviders.categoryId, schema.categories.id),
				)
				.leftJoin(
					schema.providers,
					eq(schema.providers.id, schema.categoryProviders.providerId),
				)
				.where(eq(schema.categories.id, job.categoryId));

			const category = categoryRows[0]?.category;

			if (!category) {
				throw new InternalError({
					code: INTERNAL_ERROR_CODE.CATEGORY_JOB_CATEGORY_NOT_FOUND,
					message: `Category ${job.categoryId} not found for job ${job.id}`,
				});
			}

			return {
				...job,
				category: {
					...category,
					providers: categoryRows.flatMap(({ provider }) =>
						provider ? [provider] : [],
					),
				},
			};
		});
	}

	async findByCategoryAndDate(categoryId: string, targetDate: Date) {
		return await this.db
			.select()
			.from(schema.categoryJobs)
			.where(
				and(
					eq(schema.categoryJobs.categoryId, categoryId),
					eq(schema.categoryJobs.targetDate, targetDate),
				),
			);
	}

	/**
	 * Walks the immutable dependency snapshot (`category_job_provider_fetch_jobs`)
	 * for the category jobs depending on this fetch job, not the live
	 * `category_providers` table.
	 */
	async findWaitingByProviderFetchJob(providerFetchJobId: number) {
		return await this.db
			.select({ id: schema.categoryJobs.id })
			.from(schema.categoryJobProviderFetchJobs)
			.innerJoin(
				schema.categoryJobs,
				eq(
					schema.categoryJobs.id,
					schema.categoryJobProviderFetchJobs.categoryJobId,
				),
			)
			.where(
				and(
					eq(
						schema.categoryJobProviderFetchJobs.providerFetchJobId,
						providerFetchJobId,
					),
					eq(
						schema.categoryJobs.status,
						CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS,
					),
				),
			);
	}

	async markReadyForProcessing(jobId: number) {
		return await this.db
			.update(schema.categoryJobs)
			.set({ status: CATEGORY_JOB_STATUS.PENDING })
			.where(
				and(
					eq(schema.categoryJobs.id, jobId),
					eq(
						schema.categoryJobs.status,
						CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS,
					),
				),
			)
			.returning();
	}

	/**
	 * Records that `completed` succeeded and moves the job to `next`, or leaves
	 * the state where it is when `next` is omitted (the last step of the
	 * pipeline). The retry counter is scoped to a step: reaching a new one
	 * clears it, so every step gets its own budget of attempts.
	 *
	 * Returns `null` when the job is no longer running at `completed` — another
	 * attempt moved it in the meantime, and this one must not write over it.
	 */
	async completeStep(
		jobId: number,
		completed: CategoryJobState,
		next?: CategoryJobState,
	) {
		return await this.db.transaction(async (tx) => {
			const [current] = await tx
				.select({ retry: schema.categoryJobs.retry })
				.from(schema.categoryJobs)
				.where(eq(schema.categoryJobs.id, jobId));

			if (!current) return null;

			const [job] = await tx
				.update(schema.categoryJobs)
				.set({ state: next ?? completed, error: null, retry: 0 })
				.where(
					and(
						eq(schema.categoryJobs.id, jobId),
						eq(schema.categoryJobs.status, JOB_STATUS.RUNNING),
						eq(schema.categoryJobs.state, completed),
					),
				)
				.returning();

			if (!job) return null;

			await tx.insert(schema.categoryJobEvents).values({
				categoryJobId: jobId,
				attempt: current.retry + 1,
				state: completed,
				status: JOB_STATUS.FINISHED,
			});

			return job;
		});
	}

	async setReport(jobId: number, report: { summary: string; sources: string }) {
		return await this.db
			.update(schema.categoryJobs)
			.set(report)
			.where(
				and(
					eq(schema.categoryJobs.id, jobId),
					eq(schema.categoryJobs.status, JOB_STATUS.RUNNING),
					eq(schema.categoryJobs.state, CATEGORY_JOB_STATE.CREATING_REPORT),
				),
			)
			.returning();
	}

	async markFinished(jobId: number) {
		return await this.db
			.update(schema.categoryJobs)
			.set({
				status: JOB_STATUS.FINISHED,
				error: null,
				retry: 0,
				finishedAt: new Date(),
			})
			.where(
				and(
					eq(schema.categoryJobs.id, jobId),
					eq(schema.categoryJobs.status, JOB_STATUS.RUNNING),
					eq(schema.categoryJobs.state, CATEGORY_JOB_STATE.SENDING_MESSAGE),
				),
			)
			.returning();
	}

	/** Ends the job on an error no further attempt could fix. */
	async markFailed(jobId: number, error: string) {
		return await this.db.transaction(async (tx) => {
			const [current] = await tx
				.select({
					retry: schema.categoryJobs.retry,
					state: schema.categoryJobs.state,
				})
				.from(schema.categoryJobs)
				.where(eq(schema.categoryJobs.id, jobId));

			if (!current) return null;

			const [job] = await tx
				.update(schema.categoryJobs)
				.set({
					status: JOB_STATUS.FAILED,
					error,
					finishedAt: new Date(),
				})
				.where(eq(schema.categoryJobs.id, jobId))
				.returning();

			await tx.insert(schema.categoryJobEvents).values({
				categoryJobId: jobId,
				attempt: current.retry + 1,
				state: current.state,
				status: JOB_STATUS.FAILED,
				error,
			});

			return job ?? null;
		});
	}

	async incrementRetry(jobId: number, error: string) {
		return await this.db.transaction(async (tx) => {
			const [current] = await tx
				.select({
					retry: schema.categoryJobs.retry,
					state: schema.categoryJobs.state,
				})
				.from(schema.categoryJobs)
				.where(eq(schema.categoryJobs.id, jobId));

			if (!current) return null;

			const retry = current.retry + 1;
			const failed = retry >= MAX_JOB_RETRY;
			const status = failed ? JOB_STATUS.FAILED : JOB_STATUS.PENDING;

			const [job] = await tx
				.update(schema.categoryJobs)
				.set({ error, retry, status, finishedAt: failed ? new Date() : null })
				.where(eq(schema.categoryJobs.id, jobId))
				.returning();

			await tx.insert(schema.categoryJobEvents).values({
				categoryJobId: jobId,
				attempt: retry,
				state: current.state,
				status: JOB_STATUS.FAILED,
				error,
			});

			return job ?? null;
		});
	}
}
