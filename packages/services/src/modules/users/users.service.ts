import { JOB_STATUS, SORT_ORDER, USER_SORT } from "@brief/common/constants";
import type { Paginated } from "@brief/common/types";
import {
	and,
	asc,
	type Database,
	eq,
	ilike,
	or,
	schema,
	sql,
} from "@brief/drizzle";
import { toPage } from "../../helpers/listQuery.helper.js";
import { normalizeListAdminUsersInput } from "./users.helper.js";
import type { AdminUserRow, ListAdminUsersInput } from "./users.type.js";

export class UsersService {
	constructor(private readonly db: Database) {}

	/**
	 * One page of the admin user list, with the aggregates it displays.
	 * Filtering, sorting and pagination all happen in SQL, so sorting by a
	 * count orders every reader rather than the current page.
	 *
	 * Both aggregates are LATERAL subqueries rather than two `LEFT JOIN … GROUP
	 * BY`: joining subscriptions and message_jobs side by side would multiply
	 * the rows together and make the count wrong. Each returns exactly one row
	 * per reader — an aggregate without GROUP BY always does — so neither can
	 * inflate the other. And unlike a scalar subquery in the select list, a
	 * join makes drizzle qualify every column with its table, which is what
	 * keeps `user_id = id` from being read as two columns of the same table.
	 */
	async listForAdmin(
		input: ListAdminUsersInput = {},
	): Promise<Paginated<AdminUserRow>> {
		const normalized = normalizeListAdminUsersInput(input);
		const { sort, order, searchPattern } = normalized;

		const where = searchPattern
			? or(
					ilike(schema.user.name, searchPattern),
					ilike(schema.user.email, searchPattern),
				)
			: undefined;

		const subscriptions = this.db
			.select({ count: sql<number>`count(*)::int`.as("count") })
			.from(schema.subscriptions)
			.where(eq(schema.subscriptions.userId, schema.user.id))
			.as("subscriptions_count");

		// The instant the last brief reached the reader. Only a finished
		// delivery counts: a pending or failed one has not been received.
		const lastDelivery = this.db
			.select({
				finishedAt: sql<Date | null>`max(${schema.messageJobs.finishedAt})`
					// A raw expression comes back as the driver string; only a column
					// decoder turns a timestamptz into a Date.
					.mapWith(schema.messageJobs.finishedAt)
					.as("finished_at"),
			})
			.from(schema.messageJobs)
			.where(
				and(
					eq(schema.messageJobs.userId, schema.user.id),
					eq(schema.messageJobs.status, JOB_STATUS.FINISHED),
				),
			)
			.as("last_delivery");

		const sortExpression = {
			// Names and emails sort case-insensitively: "Émilie" belongs next to
			// "élise", not in a separate uppercase block.
			[USER_SORT.NAME]: sql`lower(${schema.user.name})`,
			[USER_SORT.EMAIL]: sql`lower(${schema.user.email})`,
			[USER_SORT.CREATED_AT]: sql`${schema.user.createdAt}`,
			[USER_SORT.SUBSCRIPTIONS_COUNT]: sql`${subscriptions.count}`,
			[USER_SORT.LAST_BRIEF_AT]: sql`${lastDelivery.finishedAt}`,
		}[sort];

		const direction = order === SORT_ORDER.ASC ? sql`asc` : sql`desc`;

		const [rows, [totals]] = await Promise.all([
			this.db
				.select({
					id: schema.user.id,
					name: schema.user.name,
					email: schema.user.email,
					createdAt: schema.user.createdAt,
					subscriptionsCount: subscriptions.count,
					lastBriefAt: lastDelivery.finishedAt,
				})
				.from(schema.user)
				.leftJoinLateral(subscriptions, sql`true`)
				.leftJoinLateral(lastDelivery, sql`true`)
				.where(where)
				// The id breaks ties, without which two readers with the same count
				// could swap places between two pages and hide a row.
				.orderBy(
					sql`${sortExpression} ${direction} nulls last`,
					asc(schema.user.id),
				)
				.limit(normalized.pageSize)
				.offset(normalized.offset),

			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(schema.user)
				.where(where),
		]);

		return toPage(
			rows.map((row) => ({
				...row,
				// A LEFT JOIN on an aggregate never yields null here, but the type
				// of a left-joined column says it might.
				subscriptionsCount: row.subscriptionsCount ?? 0,
				lastBriefAt: row.lastBriefAt ?? null,
			})),
			totals?.total ?? 0,
			normalized,
		);
	}
}
