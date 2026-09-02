import {
	CATEGORY_JOB_SORT,
	FETCH_JOB_SORT,
	JOB_STATUS,
	SORT_ORDER,
} from "@brief/common/constants";
import type { Paginated } from "@brief/common/types";
import {
	and,
	type Database,
	desc,
	eq,
	ilike,
	schema,
	sql,
} from "@brief/drizzle";
import { toPage } from "../../helpers/listQuery.helper.js";
import {
	normalizeListAdminCategoryJobsInput,
	normalizeListAdminFetchJobsInput,
} from "./adminJobs.helper.js";
import type {
	AdminCategoryJobRow,
	AdminFetchJobRow,
	ListAdminCategoryJobsInput,
	ListAdminFetchJobsInput,
} from "./adminJobs.type.js";

/**
 * How many articles the editorial selection kept for this brief. A correlated
 * subquery rather than a join: joining the rows and grouping them would
 * multiply against the delivery counts below.
 */
const selectedArticlesCount = sql<number>`(
	select count(*)::int
	from ${schema.categoryJobArticles}
	where ${schema.categoryJobArticles.categoryJobId} = ${schema.categoryJobs.id}
)`;

const fetchedArticlesCount = sql<number>`(
	select count(*)::int
	from ${schema.providerFetchJobArticles}
	where ${schema.providerFetchJobArticles.providerFetchJobId} = ${schema.providerFetchJobs.id}
)`;

/**
 * Wall-clock seconds a run took, computed in SQL so the column can be sorted
 * over the whole table rather than over the page on screen. Null while the job
 * is still going — `finished_at` is only set by a terminal status.
 */
const categoryJobDuration = sql<number | null>`extract(epoch from (
	${schema.categoryJobs.finishedAt} - ${schema.categoryJobs.createdAt}
))::int`;

const fetchJobDuration = sql<number | null>`extract(epoch from (
	${schema.providerFetchJobs.finishedAt} - ${schema.providerFetchJobs.createdAt}
))::int`;

const direction = (order: string) =>
	order === SORT_ORDER.ASC ? sql`asc` : sql`desc`;

/**
 * The read side of the pipeline, for the admin job pages. Every list here is
 * filtered, sorted and paged in SQL, so sorting by a count or by a duration
 * orders every run rather than the twenty on screen.
 *
 * Deliberately apart from `CategoryJobsService` and its siblings: those claim
 * and settle rows for the workers, and none of them is reachable from the web
 * app.
 */
export class AdminJobsService {
	constructor(private db: Database) {}

	async listCategoryJobs(
		input: ListAdminCategoryJobsInput = {},
	): Promise<Paginated<AdminCategoryJobRow>> {
		const normalized = normalizeListAdminCategoryJobsInput(input);
		const { sort, order, searchPattern, status } = normalized;

		const where = and(
			searchPattern ? ilike(schema.categories.name, searchPattern) : undefined,
			status ? eq(schema.categoryJobs.status, status) : undefined,
		);

		// The three delivery figures in one LATERAL pass: three correlated
		// subqueries would scan `message_jobs` three times per row, and a plain
		// join would inflate the article count.
		const deliveries = this.db
			.select({
				total: sql<number>`count(*)::int`.as("total"),
				finished:
					sql<number>`(count(*) filter (where ${schema.messageJobs.status} = ${JOB_STATUS.FINISHED}))::int`.as(
						"finished",
					),
				failed:
					sql<number>`(count(*) filter (where ${schema.messageJobs.status} = ${JOB_STATUS.FAILED}))::int`.as(
						"failed",
					),
			})
			.from(schema.messageJobs)
			.where(eq(schema.messageJobs.categoryJobId, schema.categoryJobs.id))
			.as("deliveries");

		const sortExpression = {
			[CATEGORY_JOB_SORT.TARGET_DATE]: sql`${schema.categoryJobs.targetDate}`,
			[CATEGORY_JOB_SORT.CREATED_AT]: sql`${schema.categoryJobs.createdAt}`,
			// Case-insensitive, so "Économie" sorts next to "écologie".
			[CATEGORY_JOB_SORT.CATEGORY]: sql`lower(${schema.categories.name})`,
			[CATEGORY_JOB_SORT.STATUS]: sql`${schema.categoryJobs.status}`,
			[CATEGORY_JOB_SORT.ARTICLES_COUNT]: selectedArticlesCount,
			[CATEGORY_JOB_SORT.TOTAL_TOKENS]: sql`${schema.categoryJobs.totalTokens}`,
			[CATEGORY_JOB_SORT.DELIVERIES_FAILED]: sql`${deliveries.failed}`,
			[CATEGORY_JOB_SORT.DURATION]: categoryJobDuration,
			[CATEGORY_JOB_SORT.RETRY]: sql`${schema.categoryJobs.retry}`,
		}[sort];

		const [rows, [totals]] = await Promise.all([
			this.db
				.select({
					id: schema.categoryJobs.id,
					categoryId: schema.categories.id,
					categoryName: schema.categories.name,
					targetDate: schema.categoryJobs.targetDate,
					status: schema.categoryJobs.status,
					state: schema.categoryJobs.state,
					retry: schema.categoryJobs.retry,
					articlesCount: selectedArticlesCount,
					totalTokens: schema.categoryJobs.totalTokens,
					deliveriesTotal: deliveries.total,
					deliveriesFinished: deliveries.finished,
					deliveriesFailed: deliveries.failed,
					durationSeconds: categoryJobDuration,
					error: schema.categoryJobs.error,
					createdAt: schema.categoryJobs.createdAt,
					finishedAt: schema.categoryJobs.finishedAt,
				})
				.from(schema.categoryJobs)
				.innerJoin(
					schema.categories,
					eq(schema.categories.id, schema.categoryJobs.categoryId),
				)
				.leftJoinLateral(deliveries, sql`true`)
				.where(where)
				// The id breaks ties, without which two runs of the same day could
				// swap places between two pages and hide a row.
				.orderBy(
					sql`${sortExpression} ${direction(order)} nulls last`,
					desc(schema.categoryJobs.id),
				)
				.limit(normalized.pageSize)
				.offset(normalized.offset),

			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(schema.categoryJobs)
				.innerJoin(
					schema.categories,
					eq(schema.categories.id, schema.categoryJobs.categoryId),
				)
				.where(where),
		]);

		return toPage(
			rows.map((row) => ({
				id: row.id,
				category: { id: row.categoryId, name: row.categoryName },
				targetDate: row.targetDate,
				status: row.status,
				state: row.state,
				retry: row.retry,
				articlesCount: row.articlesCount,
				totalTokens: row.totalTokens,
				deliveries: {
					total: row.deliveriesTotal ?? 0,
					finished: row.deliveriesFinished ?? 0,
					failed: row.deliveriesFailed ?? 0,
				},
				durationSeconds: row.durationSeconds,
				error: row.error,
				createdAt: row.createdAt,
				finishedAt: row.finishedAt,
			})),
			totals?.total ?? 0,
			normalized,
		);
	}

	async listFetchJobs(
		input: ListAdminFetchJobsInput = {},
	): Promise<Paginated<AdminFetchJobRow>> {
		const normalized = normalizeListAdminFetchJobsInput(input);
		const { sort, order, searchPattern, status } = normalized;

		const where = and(
			searchPattern ? ilike(schema.providers.name, searchPattern) : undefined,
			status ? eq(schema.providerFetchJobs.status, status) : undefined,
		);

		const sortExpression = {
			[FETCH_JOB_SORT.TARGET_DATE]: sql`${schema.providerFetchJobs.targetDate}`,
			[FETCH_JOB_SORT.CREATED_AT]: sql`${schema.providerFetchJobs.createdAt}`,
			[FETCH_JOB_SORT.PROVIDER]: sql`lower(${schema.providers.name})`,
			[FETCH_JOB_SORT.STATUS]: sql`${schema.providerFetchJobs.status}`,
			[FETCH_JOB_SORT.ARTICLES_COUNT]: fetchedArticlesCount,
			[FETCH_JOB_SORT.DURATION]: fetchJobDuration,
			[FETCH_JOB_SORT.RETRY]: sql`${schema.providerFetchJobs.retry}`,
		}[sort];

		const [rows, [totals]] = await Promise.all([
			this.db
				.select({
					id: schema.providerFetchJobs.id,
					providerId: schema.providers.id,
					providerName: schema.providers.name,
					targetDate: schema.providerFetchJobs.targetDate,
					status: schema.providerFetchJobs.status,
					retry: schema.providerFetchJobs.retry,
					articlesCount: fetchedArticlesCount,
					durationSeconds: fetchJobDuration,
					error: schema.providerFetchJobs.error,
					createdAt: schema.providerFetchJobs.createdAt,
					finishedAt: schema.providerFetchJobs.finishedAt,
				})
				.from(schema.providerFetchJobs)
				.innerJoin(
					schema.providers,
					eq(schema.providers.id, schema.providerFetchJobs.providerId),
				)
				.where(where)
				.orderBy(
					sql`${sortExpression} ${direction(order)} nulls last`,
					desc(schema.providerFetchJobs.id),
				)
				.limit(normalized.pageSize)
				.offset(normalized.offset),

			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(schema.providerFetchJobs)
				.innerJoin(
					schema.providers,
					eq(schema.providers.id, schema.providerFetchJobs.providerId),
				)
				.where(where),
		]);

		return toPage(
			rows.map((row) => ({
				id: row.id,
				provider: { id: row.providerId, name: row.providerName },
				targetDate: row.targetDate,
				status: row.status,
				retry: row.retry,
				articlesCount: row.articlesCount,
				durationSeconds: row.durationSeconds,
				error: row.error,
				createdAt: row.createdAt,
				finishedAt: row.finishedAt,
			})),
			totals?.total ?? 0,
			normalized,
		);
	}
}
