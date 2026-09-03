import {
	DOMAIN_ERROR_CODE,
	LANGUAGE,
	PAGINATION,
	SHOWCASE_TOPICS_LIMIT,
} from "@brief/common/constants";
import { and, asc, eq, ilike, inArray, or, schema } from "@brief/drizzle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	asDatabase,
	fakeTransaction,
	recordingChain,
} from "../../testing/db.fake.js";
import { CategoriesService } from "./categories.service.js";

const CATEGORY_ID = "category-1";
const CREATED_AT = new Date("2026-08-01T00:00:00.000Z");
const TARGET_DATE = new Date("2026-08-17T00:00:00.000Z");

/**
 * Stands in for the `last_brief` LATERAL subquery. The service reads two
 * columns off it, both to select and to sort by, so the alias has to answer
 * with something.
 */
const LAST_BRIEF = {
	targetDate: "last_brief.target_date",
	status: "last_brief.status",
};

type Rows = {
	/** What the relational query answers for `getCategories`. */
	categories?: Record<string, unknown>[];
	/** What it answers for `getForAdmin`. */
	category?: Record<string, unknown>;
	/** The showcase names, or the admin page rows: both read `categories`. */
	rows?: Record<string, unknown>[];
	/** The matching count, as the second query of a page answers it. */
	total?: { total: number }[];
	/** The row an insert, an update or a delete hands back. */
	written?: Record<string, unknown>[];
	/** The provider ids that actually exist. */
	providers?: { id: string }[];
	/** The stored objects a delete orphans. */
	files?: { bucket: string; objectKey: string }[];
};

const harness = (rows: Rows = {}) => {
	const findMany = vi.fn().mockResolvedValue(rows.categories ?? []);
	const findFirst = vi.fn().mockResolvedValue(rows.category);

	const reads = {
		categories: recordingChain(rows.rows ?? []),
		totals: recordingChain(rows.total ?? [{ total: 0 }]),
		providers: recordingChain(rows.providers ?? []),
		files: recordingChain(rows.files ?? []),
	};
	const writes = {
		insertCategory: recordingChain(rows.written ?? [{ id: CATEGORY_ID }]),
		insertLinks: recordingChain(),
		update: recordingChain(rows.written ?? [{ id: CATEGORY_ID }]),
		deleteCategory: recordingChain(rows.written ?? [{ id: CATEGORY_ID }]),
		deleteLinks: recordingChain(),
	};

	// The subquery is built off `db.select(...)` like any other read, and ends on
	// `.as()`: that is where the alias takes over.
	Object.assign(reads.categories, { as: () => LAST_BRIEF });

	const select = (columns: Record<string, unknown> = {}) => ({
		from: (table: unknown) => {
			if ("total" in columns) return reads.totals;
			if (table === schema.providers) return reads.providers;
			if (table === schema.files) return reads.files;
			return reads.categories;
		},
	});

	const tx = {
		select,
		insert: (table: unknown) =>
			table === schema.categories
				? writes.insertCategory.insert(table)
				: writes.insertLinks.insert(table),
		update: (table: unknown) => writes.update.update(table),
		delete: (table: unknown) =>
			table === schema.categories
				? writes.deleteCategory.delete(table)
				: writes.deleteLinks.delete(table),
	};

	return {
		findMany,
		findFirst,
		reads,
		writes,
		service: new CategoriesService(
			asDatabase({
				...tx,
				...fakeTransaction(tx),
				query: { categories: { findMany, findFirst } },
			}),
		),
	};
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("getCategories", () => {
	it("keeps only the enabled categories someone follows", async () => {
		const { service, findMany } = harness();

		await service.getCategories({ isEnabled: true, hasSubscribers: true });

		// `subscriptions: true` is the relational EXISTS: at least one row in
		// `subscriptions` pointing at the category.
		expect(findMany).toHaveBeenCalledWith({
			where: { isEnabled: true, subscriptions: true },
			with: { providers: true },
		});
	});

	it("leaves out the filters the caller did not ask for", async () => {
		// An undefined entry is dropped from the WHERE rather than matched
		// against, so an unfiltered call still returns every category.
		const { service, findMany } = harness();

		await service.getCategories({});

		expect(findMany).toHaveBeenCalledWith({
			where: { isEnabled: undefined, subscriptions: undefined },
			with: { providers: true },
		});
	});
});

describe("listShowcase", () => {
	it("names the first topics and counts the rest", async () => {
		const { service } = harness({
			rows: [{ name: "Actu France" }, { name: "Économie" }],
			total: [{ total: 7 }],
		});

		await expect(service.listShowcase(LANGUAGE.FR)).resolves.toEqual({
			names: ["Actu France", "Économie"],
			remaining: 5,
		});
	});

	it("never counts a negative remainder", async () => {
		// The count and the page are two queries: a category deleted between them
		// would otherwise show as "and -1 more".
		const { service } = harness({
			rows: [{ name: "Actu France" }, { name: "Économie" }],
			total: [{ total: 1 }],
		});

		await expect(service.listShowcase(LANGUAGE.FR)).resolves.toMatchObject({
			remaining: 0,
		});
	});

	it("counts nothing when the count query comes back empty", async () => {
		const { service } = harness({ rows: [], total: [] });

		await expect(service.listShowcase(LANGUAGE.FR)).resolves.toEqual({
			names: [],
			remaining: 0,
		});
	});

	it("offers only enabled topics the reader can read, oldest first", async () => {
		const { service, reads } = harness();

		await service.listShowcase(LANGUAGE.EN);

		// Showing a reader topics in a language they did not pick would be an
		// offer we do not keep.
		expect(reads.categories.args("where")).toEqual([
			and(
				eq(schema.categories.isEnabled, true),
				eq(schema.categories.language, LANGUAGE.EN),
			),
		]);
		expect(reads.categories.args("orderBy")).toEqual([
			asc(schema.categories.createdAt),
			asc(schema.categories.id),
		]);
		expect(reads.categories.args("limit")).toEqual([SHOWCASE_TOPICS_LIMIT]);
		// The count carries the same filter, no window: it is the whole offer.
		expect(reads.totals.args("where")).toEqual(reads.categories.args("where"));
	});
});

describe("listForAdmin", () => {
	const adminRow = (overrides: Record<string, unknown> = {}) => ({
		id: CATEGORY_ID,
		name: "Actu France",
		description: "Le fil français",
		isEnabled: true,
		createdAt: CREATED_AT,
		briefsCount: 12,
		subscribersCount: 3,
		lastBriefTargetDate: TARGET_DATE,
		lastBriefStatus: "finished",
		...overrides,
	});

	it("returns the page the admin table draws", async () => {
		const { service } = harness({
			rows: [adminRow()],
			total: [{ total: 1 }],
		});

		await expect(service.listForAdmin()).resolves.toEqual({
			items: [
				{
					id: CATEGORY_ID,
					name: "Actu France",
					description: "Le fil français",
					isEnabled: true,
					createdAt: CREATED_AT,
					briefsCount: 12,
					subscribersCount: 3,
					lastBrief: { targetDate: TARGET_DATE, status: "finished" },
				},
			],
			total: 1,
			page: 1,
			pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
			pageCount: 1,
		});
	});

	it("reports no last brief until the lateral join found a whole one", async () => {
		const { service } = harness({
			rows: [
				adminRow({ lastBriefTargetDate: null, lastBriefStatus: null }),
				adminRow({ id: "category-2", lastBriefStatus: null }),
			],
		});

		const { items } = await service.listForAdmin();

		expect(items.map(({ lastBrief }) => lastBrief)).toEqual([null, null]);
	});

	it("searches the name and the description at once", async () => {
		const { service, reads } = harness();

		await service.listForAdmin({ search: " éco " });

		const where = or(
			ilike(schema.categories.name, "%éco%"),
			ilike(schema.categories.description, "%éco%"),
		);
		expect(reads.categories.args("where")).toEqual([where]);
		expect(reads.totals.args("where")).toEqual([where]);
	});

	it("clamps a page size the caller pushed past the ceiling", async () => {
		const { service, reads } = harness();

		await expect(
			service.listForAdmin({ page: 2, pageSize: 500 }),
		).resolves.toMatchObject({ pageSize: PAGINATION.MAX_PAGE_SIZE });

		expect(reads.categories.args("limit")).toEqual([PAGINATION.MAX_PAGE_SIZE]);
		expect(reads.categories.args("offset")).toEqual([PAGINATION.MAX_PAGE_SIZE]);
	});

	it("breaks ties on the id whatever the sort is", async () => {
		// Two categories with the same count could otherwise swap places between
		// two pages and hide a row.
		const { service, reads } = harness();

		await service.listForAdmin({ sort: "briefsCount", order: "asc" });

		const orderBy = reads.categories.args("orderBy") ?? [];
		expect(orderBy).toHaveLength(2);
		expect(orderBy[1]).toEqual(asc(schema.categories.id));
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

		expect(rejected.reads.categories.args("orderBy")).toEqual(
			fallback.reads.categories.args("orderBy"),
		);
	});
});

describe("getForAdmin", () => {
	it("returns the category with the ids of its providers", async () => {
		const { service } = harness({
			category: {
				id: CATEGORY_ID,
				name: "Actu France",
				description: "Le fil français",
				language: LANGUAGE.FR,
				isEnabled: true,
				providers: [{ id: "provider-1" }, { id: "provider-2" }],
			},
		});

		await expect(service.getForAdmin(CATEGORY_ID)).resolves.toEqual({
			id: CATEGORY_ID,
			name: "Actu France",
			description: "Le fil français",
			language: LANGUAGE.FR,
			isEnabled: true,
			providerIds: ["provider-1", "provider-2"],
		});
	});

	it("refuses a category that does not exist", async () => {
		const { service } = harness({ category: undefined });

		await expect(service.getForAdmin("ghost")).rejects.toMatchObject({
			code: DOMAIN_ERROR_CODE.CATEGORY_NOT_FOUND,
		});
	});
});

describe("create", () => {
	const input = {
		name: "Actu France",
		description: "Le fil français",
		language: LANGUAGE.FR,
		isEnabled: true,
		providerIds: ["provider-1"],
	};

	it("writes the category and links the providers it was given", async () => {
		const { service, writes } = harness({ providers: [{ id: "provider-1" }] });

		await expect(service.create(input)).resolves.toEqual({ id: CATEGORY_ID });

		expect(writes.insertCategory.args("values")).toEqual([
			{
				name: input.name,
				description: input.description,
				language: input.language,
				isEnabled: input.isEnabled,
			},
		]);
		expect(writes.insertLinks.args("values")).toEqual([
			[{ categoryId: CATEGORY_ID, providerId: "provider-1" }],
		]);
	});

	it("refuses to carry on when the insert hands back no row", async () => {
		const { service, writes } = harness({ written: [] });

		await expect(service.create(input)).rejects.toMatchObject({
			code: DOMAIN_ERROR_CODE.CATEGORY_NOT_FOUND,
		});

		expect(writes.insertLinks.calls).toEqual([]);
	});
});

describe("update", () => {
	const input = {
		id: CATEGORY_ID,
		name: "Actu France",
		description: "Le fil français",
		language: LANGUAGE.FR,
		isEnabled: false,
		providerIds: ["provider-1"],
	};

	it("rewrites the category and replaces its provider links", async () => {
		const { service, writes } = harness({ providers: [{ id: "provider-1" }] });

		await expect(service.update(input)).resolves.toBeUndefined();

		expect(writes.update.args("where")).toEqual([
			eq(schema.categories.id, CATEGORY_ID),
		]);
		// The links are replaced, not merged: the old ones go first.
		expect(writes.deleteLinks.args("where")).toEqual([
			eq(schema.categoryProviders.categoryId, CATEGORY_ID),
		]);
		expect(writes.insertLinks.args("values")).toEqual([
			[{ categoryId: CATEGORY_ID, providerId: "provider-1" }],
		]);
	});

	it("refuses a category that does not exist", async () => {
		const { service, writes } = harness({ written: [] });

		await expect(service.update(input)).rejects.toMatchObject({
			code: DOMAIN_ERROR_CODE.CATEGORY_NOT_FOUND,
		});

		expect(writes.deleteLinks.calls).toEqual([]);
	});

	it("clears the links when the list is empty", async () => {
		const { service, writes } = harness();

		await service.update({ ...input, providerIds: [] });

		expect(writes.deleteLinks.args("delete")).toEqual([
			schema.categoryProviders,
		]);
		expect(writes.insertLinks.calls).toEqual([]);
	});

	it("ignores provider ids that no longer exist", async () => {
		// An unknown id would fail on the foreign key and abort the whole write,
		// and a stale list from an open admin tab is the likeliest cause.
		const { service, reads, writes } = harness({ providers: [] });

		await service.update({ ...input, providerIds: ["ghost"] });

		expect(reads.providers.args("where")).toEqual([
			inArray(schema.providers.id, ["ghost"]),
		]);
		expect(writes.insertLinks.calls).toEqual([]);
	});
});

describe("deleteForAdmin", () => {
	it("hands back the audio objects the delete orphaned", async () => {
		// Read before the delete and returned for the caller to purge after the
		// commit: deleting them first would destroy audio a failed commit still
		// references.
		const files = [{ bucket: "briefs", objectKey: "audio/101-fr.mp3" }];
		const { service, reads, writes } = harness({ files });

		await expect(service.deleteForAdmin(CATEGORY_ID)).resolves.toEqual(files);

		expect(reads.files.args("where")).toEqual([
			eq(schema.categoryJobs.categoryId, CATEGORY_ID),
		]);
		expect(writes.deleteCategory.args("where")).toEqual([
			eq(schema.categories.id, CATEGORY_ID),
		]);
	});

	it("refuses a category that does not exist", async () => {
		const { service } = harness({ written: [] });

		await expect(service.deleteForAdmin("ghost")).rejects.toMatchObject({
			code: DOMAIN_ERROR_CODE.CATEGORY_NOT_FOUND,
		});
	});
});
