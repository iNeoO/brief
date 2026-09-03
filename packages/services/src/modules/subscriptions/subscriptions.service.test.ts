import { DOMAIN_ERROR_CODE, TOPICS_PAGE_SIZE } from "@brief/common/constants";
import { and, asc, desc, eq, ilike, isNull, or, schema } from "@brief/drizzle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDatabase, recordingChain } from "../../testing/db.fake.js";
import { SubscriptionsService } from "./subscriptions.service.js";

const USER_ID = "user-1";
const CATEGORY_ID = "category-1";

const topic = {
	id: CATEGORY_ID,
	name: "Actu France",
	description: "Le fil français",
	createdAt: new Date("2026-08-01T00:00:00.000Z"),
	isEnabled: true,
	briefsCount: 12,
};

/** The join clause both lists hang the subscription off. */
const subscriptionOf = (userId: string) =>
	and(
		eq(schema.subscriptions.categoryId, schema.categories.id),
		eq(schema.subscriptions.userId, userId),
	);

type Rows = {
	/** The page of topics. */
	topics?: Record<string, unknown>[];
	/** The matching count, as the second query answers it. */
	total?: { total: number }[];
	/** The category `subscribe` checks before writing. */
	category?: { id: string; isEnabled: boolean };
};

/**
 * Both lists run their rows query and their count query off the same table, so
 * the fake tells them apart by the columns they ask for: only the count selects
 * `total`.
 */
const harness = (rows: Rows = {}) => {
	const topics = recordingChain(rows.topics ?? []);
	const totals = recordingChain(rows.total ?? [{ total: 0 }]);
	const insert = recordingChain();
	const remove = recordingChain();
	const findFirst = vi.fn().mockResolvedValue(rows.category);

	const select = (columns: Record<string, unknown> = {}) => ({
		from: () => ("total" in columns ? totals : topics),
	});

	return {
		topics,
		totals,
		insert,
		remove,
		findFirst,
		service: new SubscriptionsService(
			asDatabase({
				select,
				insert: (table: unknown) => insert.insert(table),
				delete: (table: unknown) => remove.delete(table),
				query: { categories: { findFirst } },
			}),
		),
	};
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("listSubscribed", () => {
	it("returns the reader's topics with the page a pager needs", async () => {
		const { service } = harness({
			topics: [{ ...topic, subscribedAt: topic.createdAt }],
			total: [{ total: 3 }],
		});

		await expect(
			service.listSubscribed({ userId: USER_ID, page: 1 }),
		).resolves.toEqual({
			items: [{ ...topic, subscribedAt: topic.createdAt }],
			total: 3,
			page: 1,
			pageSize: TOPICS_PAGE_SIZE,
			pageCount: 1,
		});
	});

	it("keeps the topics an admin has taken out of the catalogue", async () => {
		// The reader subscribed to them and has to be able to unsubscribe, so the
		// list must not filter on `is_enabled`.
		const { service, topics } = harness();

		await service.listSubscribed({ userId: USER_ID });

		expect(topics.args("where")).toEqual([undefined]);
		expect(topics.args("innerJoin")).toEqual([
			schema.subscriptions,
			subscriptionOf(USER_ID),
		]);
	});

	it("orders by subscription date and breaks ties on the id", async () => {
		// Subscribing to several topics in one request writes the same timestamp,
		// and an unstable order would swap those rows between pages and hide one.
		const { service, topics } = harness();

		await service.listSubscribed({ userId: USER_ID });

		expect(topics.args("orderBy")).toEqual([
			desc(schema.subscriptions.createdAt),
			asc(schema.categories.id),
		]);
	});

	it("searches the name and the description at once", async () => {
		const { service, topics, totals } = harness();

		await service.listSubscribed({ userId: USER_ID, search: " france " });

		const where = or(
			ilike(schema.categories.name, "%france%"),
			ilike(schema.categories.description, "%france%"),
		);
		expect(topics.args("where")).toEqual([where]);
		// The count has to carry the same filter, or the pager lies.
		expect(totals.args("where")).toEqual([where]);
	});

	it("searches a wildcard as the literal text it is", async () => {
		const { service, topics } = harness();

		await service.listSubscribed({ userId: USER_ID, search: "100%" });

		expect(topics.args("where")).toEqual([
			or(
				ilike(schema.categories.name, "%100\\%%"),
				ilike(schema.categories.description, "%100\\%%"),
			),
		]);
	});

	it("walks the pages with a fixed page size", async () => {
		const { service, topics } = harness({ total: [{ total: 25 }] });

		await expect(
			service.listSubscribed({ userId: USER_ID, page: 3 }),
		).resolves.toMatchObject({ page: 3, pageCount: 3 });

		expect(topics.args("limit")).toEqual([TOPICS_PAGE_SIZE]);
		expect(topics.args("offset")).toEqual([2 * TOPICS_PAGE_SIZE]);
	});

	it("counts nothing when the count query comes back empty", async () => {
		const { service } = harness({ topics: [], total: [] });

		await expect(
			service.listSubscribed({ userId: USER_ID }),
		).resolves.toMatchObject({ total: 0, pageCount: 1 });
	});

	it("reads a page below the first as the first one", async () => {
		// The page comes straight from a URL: page 0 means "the beginning", not
		// an error page.
		const { service, topics } = harness();

		await expect(
			service.listSubscribed({ userId: USER_ID, page: 0 }),
		).resolves.toMatchObject({ page: 1, pageCount: 1 });

		expect(topics.args("offset")).toEqual([0]);
	});
});

describe("listAvailable", () => {
	it("hands back the catalogue with nothing marked as subscribed", async () => {
		const { service } = harness({ topics: [topic], total: [{ total: 1 }] });

		await expect(
			service.listAvailable({ userId: USER_ID }),
		).resolves.toMatchObject({
			items: [{ ...topic, subscribedAt: null }],
		});
	});

	it("puts the reader's id in the join, not in the filter", async () => {
		// In the WHERE it would drop every unsubscribed category — exactly the
		// rows this list exists to return.
		const { service, topics } = harness();

		await service.listAvailable({ userId: USER_ID });

		expect(topics.args("leftJoin")).toEqual([
			schema.subscriptions,
			subscriptionOf(USER_ID),
		]);
		expect(topics.args("where")).toEqual([
			and(
				eq(schema.categories.isEnabled, true),
				isNull(schema.subscriptions.userId),
				undefined,
			),
		]);
	});

	it("counts nothing when the count query comes back empty", async () => {
		const { service } = harness({ topics: [], total: [] });

		await expect(
			service.listAvailable({ userId: USER_ID }),
		).resolves.toMatchObject({ total: 0, pageCount: 1 });
	});

	it("orders the catalogue newest first, ties broken on the id", async () => {
		const { service, topics } = harness();

		await service.listAvailable({ userId: USER_ID });

		expect(topics.args("orderBy")).toEqual([
			desc(schema.categories.createdAt),
			asc(schema.categories.id),
		]);
	});
});

describe("subscribe", () => {
	it("records the subscription", async () => {
		const { service, insert } = harness({
			category: { id: CATEGORY_ID, isEnabled: true },
		});

		await service.subscribe({ userId: USER_ID, categoryId: CATEGORY_ID });

		expect(insert.args("insert")).toEqual([schema.subscriptions]);
		expect(insert.args("values")).toEqual([
			{ userId: USER_ID, categoryId: CATEGORY_ID },
		]);
		// Subscribing twice is the same as subscribing once.
		expect(insert.args("onConflictDoNothing")).toEqual([]);
	});

	it("refuses a topic that does not exist", async () => {
		const { service, insert } = harness({ category: undefined });

		await expect(
			service.subscribe({ userId: USER_ID, categoryId: "ghost" }),
		).rejects.toMatchObject({
			code: DOMAIN_ERROR_CODE.SUBSCRIPTION_CATEGORY_NOT_FOUND,
		});

		expect(insert.calls).toEqual([]);
	});

	it("refuses a topic an admin has disabled", async () => {
		// It is out of the catalogue: nobody new may start following it.
		const { service, insert } = harness({
			category: { id: CATEGORY_ID, isEnabled: false },
		});

		await expect(
			service.subscribe({ userId: USER_ID, categoryId: CATEGORY_ID }),
		).rejects.toMatchObject({
			code: DOMAIN_ERROR_CODE.SUBSCRIPTION_CATEGORY_DISABLED,
		});

		expect(insert.calls).toEqual([]);
	});
});

describe("unsubscribe", () => {
	it("drops this reader's subscription to that topic only", async () => {
		const { service, remove } = harness();

		await service.unsubscribe({ userId: USER_ID, categoryId: CATEGORY_ID });

		expect(remove.args("delete")).toEqual([schema.subscriptions]);
		expect(remove.args("where")).toEqual([
			and(
				eq(schema.subscriptions.userId, USER_ID),
				eq(schema.subscriptions.categoryId, CATEGORY_ID),
			),
		]);
	});

	it("stays quiet when there was nothing to unsubscribe from", async () => {
		// Unsubscribing twice, or from a topic never followed, is a no-op rather
		// than an error: the reader's intent is already satisfied.
		const { service } = harness();

		await expect(
			service.unsubscribe({ userId: USER_ID, categoryId: "ghost" }),
		).resolves.toBeUndefined();
	});
});
