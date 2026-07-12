import {
	CATEGORY_JOB_STATE,
	JOB_STATUS,
	MAX_JOB_RETRY,
} from "@brief/common/constants";
import type { CategoryJobState } from "@brief/common/types";
import { and, type Database, eq, schema } from "@brief/drizzle";
import type { CreateCategoryJobParams } from "./categoryJobs.type.js";

export class CategoryJobsService {
	constructor(private db: Database) {}

	async createJob(params: CreateCategoryJobParams) {
		return await this.db
			.insert(schema.categoryJobs)
			.values({
				categoryId: params.categoryId,
				targetDate: params.targetDate,
				status: JOB_STATUS.PENDING,
				state: CATEGORY_JOB_STATE.CREATING_REPORT,
			})
			.returning();
	}

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
				throw new Error(
					`Category ${job.categoryId} not found for job ${job.id}`,
				);
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

	async findByCategoryAndDate(categoryId: number, targetDate: Date) {
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

	async transitionState(jobId: number, newState: CategoryJobState) {
		return await this.db
			.update(schema.categoryJobs)
			.set({
				state: newState,
				error: null,
				retry: 0,
			})
			.where(eq(schema.categoryJobs.id, jobId))
			.returning();
	}

	async setSummary(jobId: number, summary: string) {
		return await this.db
			.update(schema.categoryJobs)
			.set({
				summary,
			})
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
			const status =
				retry >= MAX_JOB_RETRY ? JOB_STATUS.FAILED : JOB_STATUS.PENDING;

			const [job] = await tx
				.update(schema.categoryJobs)
				.set({ error, retry, status })
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
