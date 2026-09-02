import {
	CATEGORY_SORT,
	DOMAIN_ERROR_CODE,
	SHOWCASE_TOPICS_LIMIT,
	SORT_ORDER,
} from "@brief/common/constants";
import type { Language, Paginated } from "@brief/common/types";
import {
	and,
	asc,
	type Database,
	desc,
	eq,
	ilike,
	inArray,
	or,
	schema,
	sql,
} from "@brief/drizzle";
import { DomainError } from "@brief/infra/errors";
import { toPage } from "../../helpers/listQuery.helper.js";
import { normalizeListAdminCategoriesInput } from "./categories.helper.js";
import type {
	AdminCategoryDetail,
	AdminCategoryRow,
	CategoryWriteInput,
	DeletedFileTarget,
	ListAdminCategoriesInput,
	ShowcaseTopics,
	UpdateCategoryInput,
} from "./categories.type.js";

/**
 * Correlated scalar subqueries rather than two `LEFT JOIN … GROUP BY`: joining
 * both category_jobs and subscriptions would multiply the rows together and
 * make each count the other's row count. Both hit an index on category_id.
 */
const briefsCount = sql<number>`(
	select count(*)::int
	from ${schema.categoryJobs}
	where ${schema.categoryJobs.categoryId} = ${schema.categories.id}
)`;

const subscribersCount = sql<number>`(
	select count(*)::int
	from ${schema.subscriptions}
	where ${schema.subscriptions.categoryId} = ${schema.categories.id}
)`;

export class CategoriesService {
	constructor(private db: Database) {}

	/**
	 * Categories with their providers, narrowed by whatever the caller cares
	 * about. `hasSubscribers` becomes an EXISTS on `subscriptions`: it asks
	 * whether anyone follows the category at all, not whether they can be
	 * reached on Telegram, because a brief is published on the site too.
	 */
	async getCategories({
		isEnabled,
		hasSubscribers,
	}: {
		isEnabled?: boolean;
		hasSubscribers?: boolean;
	}) {
		return await this.db.query.categories.findMany({
			where: {
				isEnabled,
				subscriptions: hasSubscribers,
			},
			with: {
				providers: true,
			},
		});
	}

	/**
	 * The topics the landing page names, in the language the reader's interface
	 * speaks: showing a French reader topics they cannot read would be an offer
	 * we do not keep. Oldest first, so the teaser a returning reader remembers
	 * does not reshuffle — a topic added today joins the end, and once past the
	 * limit it shows up only in `remaining`.
	 */
	async listShowcase(language: Language): Promise<ShowcaseTopics> {
		const where = and(
			eq(schema.categories.isEnabled, true),
			eq(schema.categories.language, language),
		);

		const [rows, [totals]] = await Promise.all([
			this.db
				.select({ name: schema.categories.name })
				.from(schema.categories)
				.where(where)
				// `created_at` defaults to `now()`, so a seed can give several
				// categories the same instant. The id breaks the tie, and uuidv7
				// orders by creation too, so the tiebreaker agrees with the sort.
				.orderBy(asc(schema.categories.createdAt), asc(schema.categories.id))
				.limit(SHOWCASE_TOPICS_LIMIT),
			// Same filter, no window: the count is the whole offer, not this slice.
			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(schema.categories)
				.where(where),
		]);

		return {
			names: rows.map((row) => row.name),
			remaining: Math.max((totals?.total ?? 0) - rows.length, 0),
		};
	}

	/**
	 * One page of the admin category list, with the aggregates it displays.
	 * Filtering, sorting and pagination all happen in SQL, so sorting by a
	 * count orders every category rather than the current page.
	 */
	async listForAdmin(
		input: ListAdminCategoriesInput = {},
	): Promise<Paginated<AdminCategoryRow>> {
		const normalized = normalizeListAdminCategoriesInput(input);
		const { sort, order, searchPattern } = normalized;

		const where = searchPattern
			? or(
					ilike(schema.categories.name, searchPattern),
					ilike(schema.categories.description, searchPattern),
				)
			: undefined;

		// The latest job of the category, whatever its outcome. LATERAL keeps it
		// to one row per category, so it cannot inflate the counts above.
		const lastBrief = this.db
			.select({
				targetDate: schema.categoryJobs.targetDate,
				status: schema.categoryJobs.status,
			})
			.from(schema.categoryJobs)
			.where(eq(schema.categoryJobs.categoryId, schema.categories.id))
			.orderBy(desc(schema.categoryJobs.targetDate))
			.limit(1)
			.as("last_brief");

		const sortExpression = {
			// Sorting names is case-insensitive: "Économie" belongs next to
			// "écologie", not in a separate uppercase block.
			[CATEGORY_SORT.NAME]: sql`lower(${schema.categories.name})`,
			[CATEGORY_SORT.CREATED_AT]: sql`${schema.categories.createdAt}`,
			[CATEGORY_SORT.BRIEFS_COUNT]: briefsCount,
			[CATEGORY_SORT.SUBSCRIBERS_COUNT]: subscribersCount,
			[CATEGORY_SORT.LAST_BRIEF_AT]: sql`${lastBrief.targetDate}`,
		}[sort];

		const direction = order === SORT_ORDER.ASC ? sql`asc` : sql`desc`;

		const [rows, [totals]] = await Promise.all([
			this.db
				.select({
					id: schema.categories.id,
					name: schema.categories.name,
					description: schema.categories.description,
					isEnabled: schema.categories.isEnabled,
					createdAt: schema.categories.createdAt,
					briefsCount,
					subscribersCount,
					lastBriefTargetDate: lastBrief.targetDate,
					lastBriefStatus: lastBrief.status,
				})
				.from(schema.categories)
				.leftJoinLateral(lastBrief, sql`true`)
				.where(where)
				// The id breaks ties, without which two categories with the same
				// count could swap places between two pages and hide a row.
				.orderBy(
					sql`${sortExpression} ${direction} nulls last`,
					asc(schema.categories.id),
				)
				.limit(normalized.pageSize)
				.offset(normalized.offset),

			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(schema.categories)
				.where(where),
		]);

		return toPage(
			rows.map((row) => ({
				id: row.id,
				name: row.name,
				description: row.description,
				isEnabled: row.isEnabled,
				createdAt: row.createdAt,
				briefsCount: row.briefsCount,
				subscribersCount: row.subscribersCount,
				lastBrief:
					row.lastBriefTargetDate && row.lastBriefStatus
						? {
								targetDate: row.lastBriefTargetDate,
								status: row.lastBriefStatus,
							}
						: null,
			})),
			totals?.total ?? 0,
			normalized,
		);
	}

	/** The category as the edit modal needs it, providers included. */
	async getForAdmin(id: string): Promise<AdminCategoryDetail> {
		const category = await this.db.query.categories.findFirst({
			where: { id },
			with: { providers: { columns: { id: true } } },
		});

		if (!category) {
			throw new DomainError({
				code: DOMAIN_ERROR_CODE.CATEGORY_NOT_FOUND,
				message: `Category ${id} does not exist`,
			});
		}

		return {
			id: category.id,
			name: category.name,
			description: category.description,
			language: category.language,
			isEnabled: category.isEnabled,
			providerIds: category.providers.map((provider) => provider.id),
		};
	}

	async create(input: CategoryWriteInput): Promise<{ id: string }> {
		return await this.db.transaction(async (tx) => {
			const [category] = await tx
				.insert(schema.categories)
				.values({
					name: input.name,
					description: input.description,
					language: input.language,
					isEnabled: input.isEnabled,
				})
				.returning({ id: schema.categories.id });

			if (!category) {
				throw new DomainError({
					code: DOMAIN_ERROR_CODE.CATEGORY_NOT_FOUND,
					message: "Category insert returned no row",
				});
			}

			await this.replaceProviders(tx, category.id, input.providerIds);

			return category;
		});
	}

	async update({ id, ...input }: UpdateCategoryInput): Promise<void> {
		await this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(schema.categories)
				.set({
					name: input.name,
					description: input.description,
					language: input.language,
					isEnabled: input.isEnabled,
				})
				.where(eq(schema.categories.id, id))
				.returning({ id: schema.categories.id });

			if (!updated) {
				throw new DomainError({
					code: DOMAIN_ERROR_CODE.CATEGORY_NOT_FOUND,
					message: `Category ${id} does not exist`,
				});
			}

			await this.replaceProviders(tx, id, input.providerIds);
		});
	}

	async setEnabled({
		id,
		isEnabled,
	}: {
		id: string;
		isEnabled: boolean;
	}): Promise<void> {
		const [updated] = await this.db
			.update(schema.categories)
			.set({ isEnabled })
			.where(eq(schema.categories.id, id))
			.returning({ id: schema.categories.id });

		if (!updated) {
			throw new DomainError({
				code: DOMAIN_ERROR_CODE.CATEGORY_NOT_FOUND,
				message: `Category ${id} does not exist`,
			});
		}
	}

	/**
	 * Deletes the category and, by cascade, its jobs and everything hanging off
	 * them. Returns the audio objects that lost their `files` row, for the
	 * caller to purge from the bucket once this transaction has committed —
	 * deleting them first would destroy audio that a failed commit still
	 * references.
	 */
	async deleteForAdmin(id: string): Promise<DeletedFileTarget[]> {
		return await this.db.transaction(async (tx) => {
			const files = await tx
				.select({
					bucket: schema.files.bucket,
					objectKey: schema.files.objectKey,
				})
				.from(schema.files)
				.innerJoin(
					schema.categoryJobs,
					eq(schema.categoryJobs.id, schema.files.categoryJobId),
				)
				.where(eq(schema.categoryJobs.categoryId, id));

			const [deleted] = await tx
				.delete(schema.categories)
				.where(eq(schema.categories.id, id))
				.returning({ id: schema.categories.id });

			if (!deleted) {
				throw new DomainError({
					code: DOMAIN_ERROR_CODE.CATEGORY_NOT_FOUND,
					message: `Category ${id} does not exist`,
				});
			}

			return files;
		});
	}

	private async replaceProviders(
		tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
		categoryId: string,
		providerIds: string[],
	) {
		await tx
			.delete(schema.categoryProviders)
			.where(eq(schema.categoryProviders.categoryId, categoryId));

		if (providerIds.length === 0) {
			return;
		}

		// Only ids that exist: an unknown one would fail on the foreign key and
		// abort the whole write, and a stale list is the likeliest cause.
		const known = await tx
			.select({ id: schema.providers.id })
			.from(schema.providers)
			.where(inArray(schema.providers.id, providerIds));

		if (known.length === 0) {
			return;
		}

		await tx
			.insert(schema.categoryProviders)
			.values(known.map(({ id }) => ({ categoryId, providerId: id })));
	}
}
