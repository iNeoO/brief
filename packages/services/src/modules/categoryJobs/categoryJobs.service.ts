import {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
	INTERNAL_ERROR_CODE,
	JOB_STATUS,
	MAX_JOB_RETRY,
} from "@brief/common/constants";
import type { CategoryJobState } from "@brief/common/types";
import { and, type Database, eq, schema, sql } from "@brief/drizzle";
import { InternalError } from "@brief/infra/errors";
import { contributingFetchJobs } from "../articles/articles.service.js";
import type { ReleaseVerdict } from "./categoryJobs.type.js";

export const NO_CANDIDATES_ERROR = "no_candidate_articles";

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

	async findWaitingByProviderFetchJob(providerFetchJobId: number) {
		return await this.db
			.select({
				id: schema.categoryJobs.id,
				targetDate: schema.categoryJobs.targetDate,
				category: schema.categories.name,
			})
			.from(schema.categoryJobProviderFetchJobs)
			.innerJoin(
				schema.categoryJobs,
				eq(
					schema.categoryJobs.id,
					schema.categoryJobProviderFetchJobs.categoryJobId,
				),
			)
			.innerJoin(
				schema.categories,
				eq(schema.categories.id, schema.categoryJobs.categoryId),
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

	async releaseWaitingJob(jobId: number): Promise<ReleaseVerdict> {
		const claimable = and(
			eq(schema.categoryJobs.id, jobId),
			eq(schema.categoryJobs.status, CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS),
			sql`not exists (
				select 1
				from ${schema.categoryJobProviderFetchJobs}
				join ${schema.providerFetchJobs}
					on ${schema.providerFetchJobs.id} = ${schema.categoryJobProviderFetchJobs.providerFetchJobId}
				where ${schema.categoryJobProviderFetchJobs.categoryJobId} = ${jobId}
					and ${schema.providerFetchJobs.status} not in (${JOB_STATUS.FINISHED}, ${JOB_STATUS.FAILED})
			)`,
		);

		const hasDependency = sql`exists (
			select 1
			from ${schema.categoryJobProviderFetchJobs}
			where ${schema.categoryJobProviderFetchJobs.categoryJobId} = ${jobId}
		)`;

		const hasCandidate = sql`exists (
			select 1
			from ${schema.providerFetchJobArticles}
			where ${schema.providerFetchJobArticles.providerFetchJobId} in ${contributingFetchJobs(jobId)}
		)`;

		const [ready] = await this.db
			.update(schema.categoryJobs)
			.set({ status: CATEGORY_JOB_STATUS.PENDING })
			.where(and(claimable, hasDependency, hasCandidate))
			.returning({ id: schema.categoryJobs.id });

		if (ready) {
			return {
				outcome: "ready",
				failedProviders: (await this.readDependencies(jobId)).failed,
			};
		}

		const dependencies = await this.readDependencies(jobId);
		const error =
			dependencies.total === 0
				? `${NO_CANDIDATES_ERROR}: no provider is assigned to this category`
				: `${NO_CANDIDATES_ERROR}: no provider produced an article (failed: ${dependencies.failed.join(", ") || "none"})`;

		const failed = await this.db.transaction(async (tx) => {
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
				.where(and(claimable, sql`not ${hasCandidate}`))
				.returning({ id: schema.categoryJobs.id });

			if (!job) return null;

			await tx.insert(schema.categoryJobEvents).values({
				categoryJobId: jobId,
				attempt: current.retry + 1,
				state: current.state,
				status: JOB_STATUS.FAILED,
				error,
			});

			return job;
		});

		if (!failed) return { outcome: "waiting" };

		return { outcome: "failed", failedProviders: dependencies.failed, error };
	}

	private async readDependencies(jobId: number) {
		const rows = await this.db
			.select({
				status: schema.providerFetchJobs.status,
				provider: schema.providers.name,
			})
			.from(schema.categoryJobProviderFetchJobs)
			.innerJoin(
				schema.providerFetchJobs,
				eq(
					schema.providerFetchJobs.id,
					schema.categoryJobProviderFetchJobs.providerFetchJobId,
				),
			)
			.innerJoin(
				schema.providers,
				eq(schema.providers.id, schema.providerFetchJobs.providerId),
			)
			.where(eq(schema.categoryJobProviderFetchJobs.categoryJobId, jobId));

		return {
			total: rows.length,
			failed: rows
				.filter((row) => row.status === JOB_STATUS.FAILED)
				.map((row) => row.provider),
		};
	}

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

	/**
	 * Adds what one LLM call cost to this job's running totals.
	 *
	 * Adds rather than sets: a job makes two calls, and a retried step makes them
	 * again — every one of them was billed. Written with SQL arithmetic so two
	 * concurrent writers cannot read the same figure and each overwrite the
	 * other's.
	 */
	async addTokenUsage(
		jobId: number,
		usage: {
			promptTokens: number;
			completionTokens: number;
			totalTokens: number;
		},
	) {
		const [job] = await this.db
			.update(schema.categoryJobs)
			.set({
				promptTokens: sql`${schema.categoryJobs.promptTokens} + ${usage.promptTokens}`,
				completionTokens: sql`${schema.categoryJobs.completionTokens} + ${usage.completionTokens}`,
				totalTokens: sql`${schema.categoryJobs.totalTokens} + ${usage.totalTokens}`,
			})
			.where(eq(schema.categoryJobs.id, jobId))
			.returning();

		return job ?? null;
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

	/**
	 * Settles a job whose editorial selection kept nothing.
	 *
	 * Terminal, and deliberately not a failure: `error` stays null, the retry
	 * counter is left where it is rather than being spent, and nothing downstream
	 * — audio, delivery — is owed. The tokens the selection call already cost stay
	 * on the row; the day was still billed.
	 *
	 * Claimed from `running` in `creating_report`, the only place the emptiness
	 * can be observed, so a second worker that has moved the job on gets nothing
	 * back and knows not to act.
	 */
	async markNoArticlesSelected(jobId: number) {
		return await this.db
			.update(schema.categoryJobs)
			.set({
				status: CATEGORY_JOB_STATUS.NO_ARTICLES_SELECTED,
				error: null,
				finishedAt: new Date(),
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
