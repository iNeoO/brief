import { PAGINATION, USER_SORT } from "@brief/common/constants";
import { asc, ilike, or, schema } from "@brief/drizzle";
import { describe, expect, it } from "vitest";
import { asDatabase, recordingChain } from "../../testing/db.fake.js";
import { UsersService } from "./users.service.js";

const CREATED_AT = new Date("2026-08-01T00:00:00.000Z");
const LAST_BRIEF_AT = new Date("2026-09-22T06:05:00.000Z");

const userRow = (overrides: Record<string, unknown> = {}) => ({
	id: "user-1",
	name: "Ana",
	email: "ana@example.com",
	createdAt: CREATED_AT,
	subscriptionsCount: 2,
	lastBriefAt: LAST_BRIEF_AT,
	...overrides,
});

type Rows = {
	rows?: Record<string, unknown>[];
	total?: { total: number }[];
};

/**
 * Stand in for the two LATERAL subqueries. The service reads one column off
 * each, both to select and to sort by, so the aliases have to answer with
 * something.
 */
const SUBSCRIPTIONS = { count: "subscriptions_count.count" };
const LAST_DELIVERY = { finishedAt: "last_delivery.finished_at" };

const harness = (rows: Rows = {}) => {
	const reads = {
		users: recordingChain(rows.rows ?? []),
		totals: recordingChain(rows.total ?? [{ total: 0 }]),
		subscriptions: recordingChain(),
		deliveries: recordingChain(),
	};

	// Each subquery is built off `db.select(...)` like any other read, and ends
	// on `.as()`: that is where the alias takes over.
	Object.assign(reads.subscriptions, { as: () => SUBSCRIPTIONS });
	Object.assign(reads.deliveries, { as: () => LAST_DELIVERY });

	const select = (columns: Record<string, unknown>) => ({
		from: (table: unknown) => {
			if ("total" in columns) return reads.totals;
			if (table === schema.subscriptions) return reads.subscriptions;
			if (table === schema.messageJobs) return reads.deliveries;
			return reads.users;
		},
	});

	return { reads, service: new UsersService(asDatabase({ select })) };
};

describe("listForAdmin", () => {
	it("returns the page the admin table draws", async () => {
		const { service } = harness({
			rows: [userRow(), userRow({ id: "user-2", lastBriefAt: null })],
			total: [{ total: 2 }],
		});

		await expect(service.listForAdmin()).resolves.toEqual({
			items: [userRow(), userRow({ id: "user-2", lastBriefAt: null })],
			total: 2,
			page: 1,
			pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
			pageCount: 1,
		});
	});

	it("counts nothing when the count query comes back empty", async () => {
		const { service } = harness({ rows: [], total: [] });

		await expect(service.listForAdmin()).resolves.toMatchObject({
			total: 0,
			pageCount: 1,
		});
	});

	it("settles what the left joins leave null", async () => {
		// Never happens for an aggregate, but the joined columns are typed as
		// nullable and the row contract is not.
		const { service } = harness({
			rows: [userRow({ subscriptionsCount: null, lastBriefAt: undefined })],
			total: [{ total: 1 }],
		});

		const { items } = await service.listForAdmin();

		expect(items[0]).toMatchObject({
			subscriptionsCount: 0,
			lastBriefAt: null,
		});
	});

	it("searches the name and the email at once", async () => {
		const { service, reads } = harness();

		await service.listForAdmin({ search: " ana " });

		const where = or(
			ilike(schema.user.name, "%ana%"),
			ilike(schema.user.email, "%ana%"),
		);
		expect(reads.users.args("where")).toEqual([where]);
		expect(reads.totals.args("where")).toEqual([where]);
	});

	it("filters nothing when there is no search", async () => {
		const { service, reads } = harness();

		await service.listForAdmin();

		expect(reads.users.args("where")).toEqual([undefined]);
		expect(reads.totals.args("where")).toEqual([undefined]);
	});

	it("clamps a page size the caller pushed past the ceiling", async () => {
		const { service, reads } = harness();

		await expect(
			service.listForAdmin({ page: 2, pageSize: 500 }),
		).resolves.toMatchObject({ pageSize: PAGINATION.MAX_PAGE_SIZE });

		expect(reads.users.args("limit")).toEqual([PAGINATION.MAX_PAGE_SIZE]);
		expect(reads.users.args("offset")).toEqual([PAGINATION.MAX_PAGE_SIZE]);
	});

	it("breaks ties on the id whatever the sort is", async () => {
		const { service, reads } = harness();

		await service.listForAdmin({
			sort: USER_SORT.SUBSCRIPTIONS_COUNT,
			order: "asc",
		});

		const orderBy = reads.users.args("orderBy") ?? [];
		expect(orderBy).toHaveLength(2);
		expect(orderBy[1]).toEqual(asc(schema.user.id));
	});

	it("orders by the column the admin clicked", async () => {
		const byEmail = harness();
		const byDefault = harness();

		await byEmail.service.listForAdmin({ sort: USER_SORT.EMAIL });
		await byDefault.service.listForAdmin();

		expect(byEmail.reads.users.args("orderBy")).not.toEqual(
			byDefault.reads.users.args("orderBy"),
		);
	});

	it("falls back to the default sort when the key is not one it accepts", async () => {
		// The key arrives from a URL: an unknown one settles on the default
		// rather than reaching the query as a SQL fragment.
		const rejected = harness();
		const fallback = harness();

		await rejected.service.listForAdmin({
			sort: "createdAt; drop table" as never,
		});
		await fallback.service.listForAdmin();

		expect(rejected.reads.users.args("orderBy")).toEqual(
			fallback.reads.users.args("orderBy"),
		);
	});
});
