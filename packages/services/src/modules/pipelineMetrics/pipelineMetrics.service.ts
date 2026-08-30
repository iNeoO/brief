import { CATEGORY_JOB_STATUS, JOB_STATUS } from "@brief/common/constants";
import type { CategoryJobStatus, JobStatus } from "@brief/common/types";
import { type Database, eq, schema, sql } from "@brief/drizzle";

const CATEGORY_JOB_STATUSES = Object.values(CATEGORY_JOB_STATUS);
const JOB_STATUSES = Object.values(JOB_STATUS);

/**
 * A status a run never reached still has to be reported, as a zero. Prometheus
 * reads a series that stops being exposed as "no data", not as "none left", so
 * a `failed` gauge that simply disappears once the day's failure is retried
 * leaves the alert firing on the last value it saw.
 */
const zeroed = <T extends string>(statuses: readonly T[]) =>
	Object.fromEntries(statuses.map((status) => [status, 0])) as Record<
		T,
		number
	>;

const tally = <T extends string>(
	statuses: readonly T[],
	rows: { status: T; count: number }[],
) => {
	const counts = zeroed(statuses);

	for (const row of rows) {
		counts[row.status] = row.count;
	}

	return counts;
};

export type DailyPipelineCounts = {
	categoryJobs: Record<CategoryJobStatus, number>;
	providerFetchJobs: Record<JobStatus, number>;
	messageJobs: Record<JobStatus, number>;
	tokens: { prompt: number; completion: number; total: number };
};

/**
 * Counts one day's pipeline for `/metrics`. Read-only and scoped to a single
 * `targetDate` on purpose: an unfiltered count would keep every failure ever
 * recorded in the gauge, so an alert on `failed > 0` would never clear again.
 */
export class PipelineMetricsService {
	constructor(private db: Database) {}

	async getDailyCounts(targetDate: Date): Promise<DailyPipelineCounts> {
		const [categoryRows, providerFetchRows, messageRows] = await Promise.all([
			this.db
				.select({
					status: schema.categoryJobs.status,
					count: sql<number>`count(*)::int`,
					promptTokens: sql<number>`coalesce(sum(${schema.categoryJobs.promptTokens}), 0)::int`,
					completionTokens: sql<number>`coalesce(sum(${schema.categoryJobs.completionTokens}), 0)::int`,
					totalTokens: sql<number>`coalesce(sum(${schema.categoryJobs.totalTokens}), 0)::int`,
				})
				.from(schema.categoryJobs)
				.where(eq(schema.categoryJobs.targetDate, targetDate))
				.groupBy(schema.categoryJobs.status),

			this.db
				.select({
					status: schema.providerFetchJobs.status,
					count: sql<number>`count(*)::int`,
				})
				.from(schema.providerFetchJobs)
				.where(eq(schema.providerFetchJobs.targetDate, targetDate))
				.groupBy(schema.providerFetchJobs.status),

			// Message jobs carry no target date of their own — they hang off the
			// category job whose brief they deliver, so that is what dates them.
			this.db
				.select({
					status: schema.messageJobs.status,
					count: sql<number>`count(*)::int`,
				})
				.from(schema.messageJobs)
				.innerJoin(
					schema.categoryJobs,
					eq(schema.categoryJobs.id, schema.messageJobs.categoryJobId),
				)
				.where(eq(schema.categoryJobs.targetDate, targetDate))
				.groupBy(schema.messageJobs.status),
		]);

		return {
			categoryJobs: tally(CATEGORY_JOB_STATUSES, categoryRows),
			providerFetchJobs: tally(JOB_STATUSES, providerFetchRows),
			messageJobs: tally(JOB_STATUSES, messageRows),
			tokens: {
				prompt: categoryRows.reduce((sum, row) => sum + row.promptTokens, 0),
				completion: categoryRows.reduce(
					(sum, row) => sum + row.completionTokens,
					0,
				),
				total: categoryRows.reduce((sum, row) => sum + row.totalTokens, 0),
			},
		};
	}
}
