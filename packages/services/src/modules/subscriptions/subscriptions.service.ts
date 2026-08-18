import {
	CATEGORY_JOB_STATUS,
	DOMAIN_ERROR_CODE,
} from "@brief/common/constants";
import type { Paginated } from "@brief/common/types";
import {
	and,
	asc,
	type Database,
	desc,
	eq,
	ilike,
	isNull,
	or,
	schema,
	sql,
} from "@brief/drizzle";
import { DomainError } from "@brief/infra/errors";
import { normalizeListTopicsInput } from "./subscriptions.helper.js";
import type {
	ListTopicsInput,
	NormalizedListTopicsInput,
	SubscriptionTarget,
	TopicCard,
} from "./subscriptions.type.js";

/**
 * Briefs a reader can actually open, counted the way `BriefsService` defines a
 * brief: a job that reached `finished` without producing a script is not one,
 * so counting every job would advertise more than the topic has. Correlated
 * subquery rather than a join, which would multiply the category rows.
 */
const publishedBriefsCount = sql<number>`(
	select count(*)::int
	from ${schema.categoryJobs}
	where ${schema.categoryJobs.categoryId} = ${schema.categories.id}
		and ${schema.categoryJobs.status} = ${CATEGORY_JOB_STATUS.FINISHED}
		and ${schema.categoryJobs.summary} is not null
)`;

/** Everything a topic card displays, whichever list it comes from. */
const topicColumns = {
	id: schema.categories.id,
	name: schema.categories.name,
	description: schema.categories.description,
	createdAt: schema.categories.createdAt,
	isEnable: schema.categories.isEnable,
	briefsCount: publishedBriefsCount,
};

/**
 * The column is nullable with a `true` default, so a row that never had the
 * flag written is enabled — the same reading as the admin list.
 */
const isEnabled = or(
	eq(schema.categories.isEnable, true),
	isNull(schema.categories.isEnable),
);

const searchFilter = (pattern: string | undefined) =>
	pattern
		? or(
				ilike(schema.categories.name, pattern),
				ilike(schema.categories.description, pattern),
			)
		: undefined;

const toPage = <TItem>(
	items: TItem[],
	total: number,
	{ page, pageSize }: NormalizedListTopicsInput,
): Paginated<TItem> => ({
	items,
	total,
	page,
	pageSize,
	pageCount: Math.max(1, Math.ceil(total / pageSize)),
});

export class SubscriptionsService {
	constructor(private db: Database) {}

	/**
	 * The topics this user follows, most recently subscribed first. Disabled
	 * categories stay in the list: the user subscribed to them and must be able
	 * to unsubscribe once an admin has taken them out of the catalogue.
	 */
	async listSubscribed({
		userId,
		page,
		search,
	}: ListTopicsInput): Promise<Paginated<TopicCard>> {
		const normalized = normalizeListTopicsInput({ page, search });
		const join = this.subscriptionOf(userId);
		const where = searchFilter(normalized.searchPattern);

		const [rows, [totals]] = await Promise.all([
			this.db
				.select({
					...topicColumns,
					subscribedAt: schema.subscriptions.createdAt,
				})
				.from(schema.categories)
				.innerJoin(schema.subscriptions, join)
				.where(where)
				// The id breaks ties: subscribing to several topics in the same
				// request writes the same timestamp, and an unstable order would
				// swap those rows between two pages and hide one.
				.orderBy(
					desc(schema.subscriptions.createdAt),
					asc(schema.categories.id),
				)
				.limit(normalized.pageSize)
				.offset((normalized.page - 1) * normalized.pageSize),

			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(schema.categories)
				.innerJoin(schema.subscriptions, join)
				.where(where),
		]);

		return toPage(
			rows.map((row) => ({ ...row, isEnable: row.isEnable ?? true })),
			totals?.total ?? 0,
			normalized,
		);
	}

	/**
	 * The catalogue minus what this user already follows, newest first. The
	 * anti-join is a LEFT JOIN with no match rather than a NOT IN: the
	 * subscription row carries the user id, which a subquery would have to
	 * scan for twice.
	 */
	async listAvailable({
		userId,
		page,
		search,
	}: ListTopicsInput): Promise<Paginated<TopicCard>> {
		const normalized = normalizeListTopicsInput({ page, search });
		const join = this.subscriptionOf(userId);
		const where = and(
			isEnabled,
			isNull(schema.subscriptions.userId),
			searchFilter(normalized.searchPattern),
		);

		const [rows, [totals]] = await Promise.all([
			this.db
				.select(topicColumns)
				.from(schema.categories)
				.leftJoin(schema.subscriptions, join)
				.where(where)
				.orderBy(desc(schema.categories.createdAt), asc(schema.categories.id))
				.limit(normalized.pageSize)
				.offset((normalized.page - 1) * normalized.pageSize),

			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(schema.categories)
				.leftJoin(schema.subscriptions, join)
				.where(where),
		]);

		return toPage(
			// Every row here matched `isEnabled`, hence the flag without a fallback.
			rows.map((row) => ({ ...row, isEnable: true, subscribedAt: null })),
			totals?.total ?? 0,
			normalized,
		);
	}

	async subscribe({ userId, categoryId }: SubscriptionTarget) {
		const category = await this.db.query.categories.findFirst({
			columns: { id: true, isEnable: true },
			where: { id: categoryId },
		});

		if (!category) {
			throw new DomainError({
				code: DOMAIN_ERROR_CODE.SUBSCRIPTION_CATEGORY_NOT_FOUND,
				message: `Category ${categoryId} does not exist`,
			});
		}

		// Explicitly `false`: the column is nullable with a `true` default, and a
		// null reads as enabled everywhere else — including the list this call
		// comes from, which would otherwise offer a topic it cannot subscribe to.
		if (category.isEnable === false) {
			throw new DomainError({
				code: DOMAIN_ERROR_CODE.SUBSCRIPTION_CATEGORY_DISABLED,
				message: `Category ${categoryId} is disabled`,
			});
		}

		await this.db
			.insert(schema.subscriptions)
			.values({ userId, categoryId })
			.onConflictDoNothing();
	}

	async unsubscribe({ userId, categoryId }: SubscriptionTarget) {
		await this.db
			.delete(schema.subscriptions)
			.where(
				and(
					eq(schema.subscriptions.userId, userId),
					eq(schema.subscriptions.categoryId, categoryId),
				),
			);
	}

	/**
	 * Join clause tying a category to *this* user's subscription. The user id
	 * belongs here rather than in the WHERE: on the anti-join it decides which
	 * rows match, and a WHERE would drop every unsubscribed category instead.
	 */
	private subscriptionOf(userId: string) {
		return and(
			eq(schema.subscriptions.categoryId, schema.categories.id),
			eq(schema.subscriptions.userId, userId),
		);
	}
}
