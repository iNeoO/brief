import { ADMIN_STATS_WINDOW_DAYS } from "@brief/common/constants";
import { gte, schema } from "@brief/drizzle";
import { describe, expect, it } from "vitest";
import { asDatabase, recordingChain } from "../../testing/db.fake.js";
import { AdminStatsService } from "./adminStats.service.js";

const NOW = new Date("2026-09-23T10:00:00.000Z");
const SINCE = new Date("2026-08-25T00:00:00.000Z");

const PRICING = {
	llm: { promptPerMillionTokens: 1, completionPerMillionTokens: 4 },
	tts: { perMillionCharacters: 10 },
};

// The tables are the map keys: name them once for the rows and the reads.
const T = {
	user: schema.user,
	telegramPairings: schema.telegramPairings,
	subscriptions: schema.subscriptions,
	files: schema.files,
	categoryJobs: schema.categoryJobs,
	messageJobs: schema.messageJobs,
	articles: schema.articles,
	providerFetchJobs: schema.providerFetchJobs,
	providers: schema.providers,
	categories: schema.categories,
} as const;

type TableName = keyof typeof T;

const NAME_OF = new Map<unknown, TableName>(
	(Object.keys(T) as TableName[]).map((name) => [T[name], name]),
);

type Rows = Partial<Record<TableName, Record<string, unknown>[]>>;

/**
 * Every read starts on `db.select(...).from(table)`: the fake hands a
 * distinct chain per table, so each query keeps its own rows and its own
 * clauses. The LATERAL subqueries end on `.as()`, where an alias object
 * naming their columns takes over.
 */
const harness = (rows: Rows = {}) => {
	const chains = new Map<TableName, ReturnType<typeof recordingChain>>();

	const chainFor = (table: unknown) => {
		const name = NAME_OF.get(table);
		if (!name) throw new Error("Unexpected table");

		let chain = chains.get(name);

		if (!chain) {
			chain = recordingChain(rows[name] ?? []);
			Object.assign(chain, {
				as: (alias: string) => ({
					inWindow: `${alias}.in_window`,
					lastAt: `${alias}.last_at`,
					failed: `${alias}.failed`,
					total: `${alias}.total`,
					produced: `${alias}.produced`,
					tokens: `${alias}.tokens`,
				}),
			});
			chains.set(name, chain);
		}

		return chain;
	};

	const db = asDatabase({
		select: () => ({ from: (table: unknown) => chainFor(table) }),
	});

	return {
		reads: (table: unknown) => chainFor(table),
		service: new AdminStatsService(db, PRICING),
	};
};

describe("getOverview", () => {
	it("gathers the tiles and prices the window's usage", async () => {
		const { service } = harness({
			user: [{ total: 40, emailVerified: 30, newInWindow: 5 }],
			telegramPairings: [{ total: 12 }],
			subscriptions: [{ total: 25 }],
			files: [{ bytes: 5_000_000_000 }],
			categoryJobs: [
				{
					produced: 60,
					promptTokens: 2_000_000,
					completionTokens: 500_000,
					ttsCharacters: 3_000_000,
				},
			],
			messageJobs: [{ finished: 300 }],
		});

		await expect(service.getOverview(NOW)).resolves.toEqual({
			windowDays: ADMIN_STATS_WINDOW_DAYS,
			since: "2026-08-25",
			users: {
				total: 40,
				emailVerified: 30,
				telegramPaired: 12,
				subscribed: 25,
				newInWindow: 5,
			},
			window: {
				briefsProduced: 60,
				deliveriesFinished: 300,
				promptTokens: 2_000_000,
				completionTokens: 500_000,
				ttsCharacters: 3_000_000,
			},
			audioStorageBytes: 5_000_000_000,
			cost: { llm: 4, tts: 30, total: 34, currency: "USD" },
		});
	});

	it("reads zeros off an empty database", async () => {
		const { service } = harness();

		await expect(service.getOverview(NOW)).resolves.toMatchObject({
			users: {
				total: 0,
				emailVerified: 0,
				telegramPaired: 0,
				subscribed: 0,
				newInWindow: 0,
			},
			window: { briefsProduced: 0, deliveriesFinished: 0, promptTokens: 0 },
			audioStorageBytes: 0,
			cost: { llm: 0, tts: 0, total: 0 },
		});
	});

	it("bounds the window's figures by the target date, not the users", async () => {
		const { service, reads } = harness();

		await service.getOverview(NOW);

		expect(reads(T.categoryJobs).args("where")).toEqual([
			gte(schema.categoryJobs.targetDate, SINCE),
		]);
		// Every reader counts, whenever they signed up.
		expect(reads(T.user).args("where")).toBeUndefined();
	});
});

describe("getDailySeries", () => {
	it("lays the four counts over the window, zero where nothing ran", async () => {
		const { service } = harness({
			articles: [{ day: "2026-09-23", articles: 80 }],
			categoryJobs: [
				{
					day: "2026-09-23",
					briefsProduced: 3,
					briefsFailed: 1,
					briefsWithoutArticles: 0,
					promptTokens: 100,
					completionTokens: 20,
					ttsCharacters: 4_000,
					averageBriefDurationSeconds: 95.5,
				},
			],
			providerFetchJobs: [{ day: "2026-09-22", fetchesFailed: 2 }],
			messageJobs: [
				{
					day: "2026-09-23",
					deliveriesTotal: 10,
					deliveriesFinished: 9,
					deliveriesFailed: 1,
				},
			],
		});

		const days = await service.getDailySeries(NOW);

		expect(days).toHaveLength(ADMIN_STATS_WINDOW_DAYS);
		expect(days[0]?.day).toBe("2026-08-25");
		expect(days.at(-2)).toEqual({
			day: "2026-09-22",
			articles: 0,
			briefsProduced: 0,
			briefsFailed: 0,
			briefsWithoutArticles: 0,
			fetchesFailed: 2,
			deliveriesTotal: 0,
			deliveriesFinished: 0,
			deliveriesFailed: 0,
			promptTokens: 0,
			completionTokens: 0,
			ttsCharacters: 0,
			averageBriefDurationSeconds: null,
		});
		expect(days.at(-1)).toEqual({
			day: "2026-09-23",
			articles: 80,
			briefsProduced: 3,
			briefsFailed: 1,
			briefsWithoutArticles: 0,
			fetchesFailed: 0,
			deliveriesTotal: 10,
			deliveriesFinished: 9,
			deliveriesFailed: 1,
			promptTokens: 100,
			completionTokens: 20,
			ttsCharacters: 4_000,
			averageBriefDurationSeconds: 95.5,
		});
	});

	it("bounds every count by the window and groups it by day", async () => {
		const { service, reads } = harness();

		await service.getDailySeries(NOW);

		expect(reads(T.articles).args("where")).toEqual([
			gte(schema.articles.createdAt, SINCE),
		]);
		for (const table of [
			T.articles,
			T.categoryJobs,
			T.providerFetchJobs,
			T.messageJobs,
		]) {
			expect(reads(table).args("groupBy")).toHaveLength(1);
		}
	});

	it("drops a row dated outside the window", async () => {
		const { service } = harness({
			articles: [{ day: "2026-09-24", articles: 7 }],
		});

		const days = await service.getDailySeries(NOW);

		expect(days).toHaveLength(ADMIN_STATS_WINDOW_DAYS);
		expect(days.every((day) => day.articles === 0)).toBe(true);
	});
});

describe("listProviders", () => {
	it("settles what the left joins leave null", async () => {
		const lastArticleAt = new Date("2026-09-20T05:00:00.000Z");
		const { service } = harness({
			providers: [
				{
					id: "p1",
					name: "Le Monde",
					isEnabled: true,
					lastFetchedAt: NOW,
					lastArticleAt,
					articlesInWindow: 40,
					fetchesFailedInWindow: 1,
				},
				{
					id: "p2",
					name: "Dead feed",
					isEnabled: false,
					lastFetchedAt: null,
					lastArticleAt: null,
					articlesInWindow: null,
					fetchesFailedInWindow: null,
				},
			],
		});

		await expect(service.listProviders(NOW)).resolves.toEqual([
			{
				id: "p1",
				name: "Le Monde",
				isEnabled: true,
				lastFetchedAt: NOW,
				lastArticleAt,
				articlesInWindow: 40,
				fetchesFailedInWindow: 1,
			},
			{
				id: "p2",
				name: "Dead feed",
				isEnabled: false,
				lastFetchedAt: null,
				lastArticleAt: null,
				articlesInWindow: 0,
				fetchesFailedInWindow: 0,
			},
		]);
	});

	it("joins both aggregates laterally, one row per source", async () => {
		const { service, reads } = harness();

		await service.listProviders(NOW);

		const joins = reads(T.providers).calls.filter(
			(call) => call.method === "leftJoinLateral",
		);
		expect(joins).toHaveLength(2);
		// The article count is bounded by the window; the last article is not.
		expect(reads(T.articles).args("where")).not.toBeUndefined();
	});
});

describe("listCategories", () => {
	it("settles what the left joins leave null", async () => {
		const { service } = harness({
			categories: [
				{
					id: "c1",
					name: "Tech",
					isEnabled: true,
					subscribersCount: 8,
					briefsProducedInWindow: 28,
					tokensInWindow: 900_000,
				},
				{
					id: "c2",
					name: "Nobody's topic",
					isEnabled: true,
					subscribersCount: null,
					briefsProducedInWindow: null,
					tokensInWindow: null,
				},
			],
		});

		await expect(service.listCategories(NOW)).resolves.toEqual([
			{
				id: "c1",
				name: "Tech",
				isEnabled: true,
				subscribersCount: 8,
				briefsProducedInWindow: 28,
				tokensInWindow: 900_000,
			},
			{
				id: "c2",
				name: "Nobody's topic",
				isEnabled: true,
				subscribersCount: 0,
				briefsProducedInWindow: 0,
				tokensInWindow: 0,
			},
		]);
	});

	it("joins both aggregates laterally, one row per category", async () => {
		const { service, reads } = harness();

		await service.listCategories(NOW);

		const joins = reads(T.categories).calls.filter(
			(call) => call.method === "leftJoinLateral",
		);
		expect(joins).toHaveLength(2);
	});
});
