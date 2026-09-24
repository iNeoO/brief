import {
	ADMIN_STATS_WINDOW_DAYS,
	CATEGORY_JOB_STATUS,
	JOB_STATUS,
	TELEGRAM_PAIRING_STATUS,
} from "@brief/common/constants";
import { and, asc, type Database, eq, gte, schema, sql } from "@brief/drizzle";
import {
	estimateCost,
	fillDays,
	statsWindow,
	toDayKey,
} from "./adminStats.helper.js";
import type {
	AdminStatsCategoryRow,
	AdminStatsDay,
	AdminStatsOverview,
	AdminStatsPricing,
	AdminStatsProviderRow,
} from "./adminStats.type.js";

const count = sql<number>`count(*)::int`;

/**
 * `sum()` and `count()` come back as bigint, which the driver hands over as a
 * string: everything is cast to a JS-sized number. Bytes get `float8`, since
 * a bucket of audio outgrows an int.
 */
const sumInt = (expression: unknown) =>
	sql<number>`coalesce(sum(${expression}), 0)::int`;

const countWhere = (condition: unknown) =>
	sql<number>`count(*) filter (where ${condition})::int`;

/** A plain `date` column as the key of its day. */
const dayOfDate = (column: unknown) =>
	sql<string>`to_char(${column}, 'YYYY-MM-DD')`;

/** A timestamptz read in UTC, so the day does not shift with the session zone. */
const dayOfInstant = (column: unknown) =>
	sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD')`;

const briefFinished = eq(
	schema.categoryJobs.status,
	CATEGORY_JOB_STATUS.FINISHED,
);

/**
 * The text a finished brief sent to the speech API. `summary` is the only
 * trace of it — the character count is not recorded — so this is what the
 * TTS half of the estimate is priced on.
 */
const ttsCharacters = sql<number>`coalesce(sum(length(${schema.categoryJobs.summary})) filter (where ${briefFinished}), 0)::int`;

const emptyDay = (day: string): AdminStatsDay => ({
	day,
	articles: 0,
	briefsProduced: 0,
	briefsFailed: 0,
	briefsWithoutArticles: 0,
	fetchesFailed: 0,
	deliveriesTotal: 0,
	deliveriesFinished: 0,
	deliveriesFailed: 0,
	promptTokens: 0,
	completionTokens: 0,
	ttsCharacters: 0,
	averageBriefDurationSeconds: null,
});

/**
 * The read models behind the admin home. Every method looks at the same
 * window, `ADMIN_STATS_WINDOW_DAYS` up to today, so a total on a tile can be
 * checked against the chart under it.
 *
 * Aggregates that could multiply each other — a per-source article count next
 * to a per-source failure count — are LATERAL subqueries, the same pattern as
 * the admin lists. A correlated scalar subquery in a single-table select
 * would be rendered by drizzle without table qualifiers, and `user_id = id`
 * would then compare two columns of the same table.
 */
export class AdminStatsService {
	constructor(
		private readonly db: Database,
		private readonly pricing: AdminStatsPricing,
	) {}

	async getOverview(now = new Date()): Promise<AdminStatsOverview> {
		const { since } = statsWindow(now, ADMIN_STATS_WINDOW_DAYS);

		const [[users], [pairings], [subscribed], [audio], [briefs], [deliveries]] =
			await Promise.all([
				this.db
					.select({
						total: count,
						emailVerified: countWhere(eq(schema.user.emailVerified, true)),
						newInWindow: countWhere(gte(schema.user.createdAt, since)),
					})
					.from(schema.user),

				this.db
					.select({ total: count })
					.from(schema.telegramPairings)
					.where(
						eq(
							schema.telegramPairings.status,
							TELEGRAM_PAIRING_STATUS.VERIFIED,
						),
					),

				this.db
					.select({
						total: sql<number>`count(distinct ${schema.subscriptions.userId})::int`,
					})
					.from(schema.subscriptions),

				this.db
					.select({
						bytes: sql<number>`coalesce(sum(${schema.files.size}), 0)::float8`,
					})
					.from(schema.files),

				this.db
					.select({
						produced: countWhere(briefFinished),
						promptTokens: sumInt(schema.categoryJobs.promptTokens),
						completionTokens: sumInt(schema.categoryJobs.completionTokens),
						ttsCharacters,
					})
					.from(schema.categoryJobs)
					.where(gte(schema.categoryJobs.targetDate, since)),

				// Message jobs carry no target date of their own — they hang off the
				// category job whose brief they deliver, so that is what dates them.
				this.db
					.select({ finished: count })
					.from(schema.messageJobs)
					.innerJoin(
						schema.categoryJobs,
						eq(schema.categoryJobs.id, schema.messageJobs.categoryJobId),
					)
					.where(
						and(
							gte(schema.categoryJobs.targetDate, since),
							eq(schema.messageJobs.status, JOB_STATUS.FINISHED),
						),
					),
			]);

		const usage = {
			promptTokens: briefs?.promptTokens ?? 0,
			completionTokens: briefs?.completionTokens ?? 0,
			ttsCharacters: briefs?.ttsCharacters ?? 0,
		};

		return {
			windowDays: ADMIN_STATS_WINDOW_DAYS,
			since: toDayKey(since),
			users: {
				total: users?.total ?? 0,
				emailVerified: users?.emailVerified ?? 0,
				telegramPaired: pairings?.total ?? 0,
				subscribed: subscribed?.total ?? 0,
				newInWindow: users?.newInWindow ?? 0,
			},
			window: {
				...usage,
				briefsProduced: briefs?.produced ?? 0,
				deliveriesFinished: deliveries?.finished ?? 0,
			},
			audioStorageBytes: audio?.bytes ?? 0,
			cost: estimateCost(usage, this.pricing),
		};
	}

	/**
	 * One row per day of the window, oldest first, every figure zero on a day
	 * nothing ran. Four grouped queries rather than one: they count different
	 * tables on different date columns, and a join would multiply them.
	 */
	async getDailySeries(now = new Date()): Promise<AdminStatsDay[]> {
		const { since, dayKeys } = statsWindow(now, ADMIN_STATS_WINDOW_DAYS);

		const articleDay = dayOfInstant(schema.articles.createdAt);
		const briefDay = dayOfDate(schema.categoryJobs.targetDate);
		const fetchDay = dayOfDate(schema.providerFetchJobs.targetDate);

		const [articles, briefs, fetches, deliveries] = await Promise.all([
			this.db
				.select({ day: articleDay, articles: count })
				.from(schema.articles)
				.where(gte(schema.articles.createdAt, since))
				.groupBy(articleDay),

			this.db
				.select({
					day: briefDay,
					briefsProduced: countWhere(briefFinished),
					briefsFailed: countWhere(
						eq(schema.categoryJobs.status, CATEGORY_JOB_STATUS.FAILED),
					),
					briefsWithoutArticles: countWhere(
						eq(
							schema.categoryJobs.status,
							CATEGORY_JOB_STATUS.NO_ARTICLES_SELECTED,
						),
					),
					promptTokens: sumInt(schema.categoryJobs.promptTokens),
					completionTokens: sumInt(schema.categoryJobs.completionTokens),
					ttsCharacters,
					averageBriefDurationSeconds: sql<
						number | null
					>`avg(extract(epoch from (${schema.categoryJobs.finishedAt} - ${schema.categoryJobs.createdAt}))) filter (where ${briefFinished})::float8`,
				})
				.from(schema.categoryJobs)
				.where(gte(schema.categoryJobs.targetDate, since))
				.groupBy(briefDay),

			this.db
				.select({
					day: fetchDay,
					fetchesFailed: countWhere(
						eq(schema.providerFetchJobs.status, JOB_STATUS.FAILED),
					),
				})
				.from(schema.providerFetchJobs)
				.where(gte(schema.providerFetchJobs.targetDate, since))
				.groupBy(fetchDay),

			this.db
				.select({
					day: briefDay,
					deliveriesTotal: count,
					deliveriesFinished: countWhere(
						eq(schema.messageJobs.status, JOB_STATUS.FINISHED),
					),
					deliveriesFailed: countWhere(
						eq(schema.messageJobs.status, JOB_STATUS.FAILED),
					),
				})
				.from(schema.messageJobs)
				.innerJoin(
					schema.categoryJobs,
					eq(schema.categoryJobs.id, schema.messageJobs.categoryJobId),
				)
				.where(gte(schema.categoryJobs.targetDate, since))
				.groupBy(briefDay),
		]);

		const merged = new Map<string, AdminStatsDay>();
		const dayOf = (day: string) => {
			const existing = merged.get(day);
			if (existing) return existing;

			const fresh = emptyDay(day);
			merged.set(day, fresh);
			return fresh;
		};

		for (const row of articles) Object.assign(dayOf(row.day), row);
		for (const row of briefs) Object.assign(dayOf(row.day), row);
		for (const row of fetches) Object.assign(dayOf(row.day), row);
		for (const row of deliveries) Object.assign(dayOf(row.day), row);

		return fillDays(dayKeys, [...merged.values()], emptyDay);
	}

	/**
	 * Every source with what it brought in over the window and when it last
	 * brought anything at all — the second figure is what tells a dead feed
	 * from a quiet one. Ordered by name; the page decides what to surface.
	 */
	async listProviders(now = new Date()): Promise<AdminStatsProviderRow[]> {
		const { since } = statsWindow(now, ADMIN_STATS_WINDOW_DAYS);

		const articles = this.db
			.select({
				inWindow: countWhere(gte(schema.articles.createdAt, since)).as(
					"in_window",
				),
				lastAt: sql<Date | null>`max(${schema.articles.createdAt})`
					// A raw expression comes back as the driver string; only a column
					// decoder turns a timestamptz into a Date.
					.mapWith(schema.articles.createdAt)
					.as("last_at"),
			})
			.from(schema.articles)
			.where(eq(schema.articles.providerId, schema.providers.id))
			.as("provider_articles");

		const fetches = this.db
			.select({ failed: count.as("failed") })
			.from(schema.providerFetchJobs)
			.where(
				and(
					eq(schema.providerFetchJobs.providerId, schema.providers.id),
					eq(schema.providerFetchJobs.status, JOB_STATUS.FAILED),
					gte(schema.providerFetchJobs.targetDate, since),
				),
			)
			.as("provider_fetches");

		const rows = await this.db
			.select({
				id: schema.providers.id,
				name: schema.providers.name,
				isEnabled: schema.providers.isEnabled,
				lastFetchedAt: schema.providers.lastFetchedAt,
				lastArticleAt: articles.lastAt,
				articlesInWindow: articles.inWindow,
				fetchesFailedInWindow: fetches.failed,
			})
			.from(schema.providers)
			.leftJoinLateral(articles, sql`true`)
			.leftJoinLateral(fetches, sql`true`)
			.orderBy(sql`lower(${schema.providers.name})`, asc(schema.providers.id));

		return rows.map((row) => ({
			...row,
			lastArticleAt: row.lastArticleAt ?? null,
			articlesInWindow: row.articlesInWindow ?? 0,
			fetchesFailedInWindow: row.fetchesFailedInWindow ?? 0,
		}));
	}

	/**
	 * Every category with who follows it and what it cost over the window: a
	 * category nobody follows still spends tokens every morning.
	 */
	async listCategories(now = new Date()): Promise<AdminStatsCategoryRow[]> {
		const { since } = statsWindow(now, ADMIN_STATS_WINDOW_DAYS);

		const subscribers = this.db
			.select({ total: count.as("total") })
			.from(schema.subscriptions)
			.where(eq(schema.subscriptions.categoryId, schema.categories.id))
			.as("category_subscribers");

		const briefs = this.db
			.select({
				produced: countWhere(briefFinished).as("produced"),
				tokens: sumInt(schema.categoryJobs.totalTokens).as("tokens"),
			})
			.from(schema.categoryJobs)
			.where(
				and(
					eq(schema.categoryJobs.categoryId, schema.categories.id),
					gte(schema.categoryJobs.targetDate, since),
				),
			)
			.as("category_briefs");

		const rows = await this.db
			.select({
				id: schema.categories.id,
				name: schema.categories.name,
				isEnabled: schema.categories.isEnabled,
				subscribersCount: subscribers.total,
				briefsProducedInWindow: briefs.produced,
				tokensInWindow: briefs.tokens,
			})
			.from(schema.categories)
			.leftJoinLateral(subscribers, sql`true`)
			.leftJoinLateral(briefs, sql`true`)
			.orderBy(
				sql`lower(${schema.categories.name})`,
				asc(schema.categories.id),
			);

		return rows.map((row) => ({
			...row,
			subscribersCount: row.subscribersCount ?? 0,
			briefsProducedInWindow: row.briefsProducedInWindow ?? 0,
			tokensInWindow: row.tokensInWindow ?? 0,
		}));
	}
}
