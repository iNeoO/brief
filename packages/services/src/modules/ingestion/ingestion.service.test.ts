import { CONNECTOR_KIND } from "@brief/common/constants";
import type { Database } from "@brief/drizzle";
import { schema } from "@brief/drizzle";
import { InternalError } from "@brief/infra/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticlesService } from "../articles/articles.service.js";
import type { ProvidersService } from "../providers/providers.service.js";
import { getConnector } from "./connector.registry.js";
import { IngestionService } from "./ingestion.service.js";
import type { Provider } from "./ingestion.type.js";

vi.mock("./connector.registry.js", () => ({ getConnector: vi.fn() }));

const getConnectorMock = vi.mocked(getConnector);

const PROVIDER_FETCH_JOB_ID = 7;

const provider = (overrides: Partial<Provider> = {}): Provider =>
	({
		id: "provider-1",
		name: "Example",
		slug: "example",
		url: "https://example.test/rss",
		kind: CONNECTOR_KIND.RSS,
		isEnabled: true,
		fetchLimit: 5,
		lastFetchedAt: null,
		createdAt: new Date("2026-08-17T06:00:00.000Z"),
		updatedAt: new Date("2026-08-17T06:00:00.000Z"),
		...overrides,
	}) as Provider;

const rawArticle = (n: number, overrides = {}) => ({
	url: `https://example.test/article-${n}`,
	title: `Article ${n}`,
	description: `Description ${n}`,
	content: `Content ${n}`,
	imageUrl: null,
	publishedAt: new Date(`2026-08-17T0${n}:00:00.000Z`),
	...overrides,
});

const fetchLatest = vi.fn();
const createManyArticles = vi.fn();
const findByProviderAndUrls = vi.fn();
const touchLastFetchedAt = vi.fn();

/** Collects what would be written to `provider_fetch_job_articles`. */
const snapshots: { table: unknown; rows: unknown }[] = [];
const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);

const db = {
	insert: vi.fn((table: unknown) => ({
		values: (rows: unknown) => {
			snapshots.push({ table, rows });
			return { onConflictDoNothing };
		},
	})),
};

const ingest = (input: Provider = provider()) =>
	new IngestionService(
		db as unknown as Database,
		{
			createManyArticles,
			findByProviderAndUrls,
		} as unknown as ArticlesService,
		{ touchLastFetchedAt } as unknown as ProvidersService,
	).ingestProvider(PROVIDER_FETCH_JOB_ID, input);

beforeEach(() => {
	vi.clearAllMocks();
	snapshots.length = 0;
	getConnectorMock.mockReturnValue({ fetchLatest });
	fetchLatest.mockResolvedValue([rawArticle(1)]);
	createManyArticles.mockResolvedValue([{ id: "article-1" }]);
	findByProviderAndUrls.mockResolvedValue([{ id: "article-1" }]);
	touchLastFetchedAt.mockResolvedValue(undefined);
});

describe("ingestProvider", () => {
	it("stores the fetched articles under their canonical url", async () => {
		fetchLatest.mockResolvedValue([
			rawArticle(1, { url: "/article-1?utm_source=rss", description: null }),
		]);

		await ingest();

		expect(fetchLatest).toHaveBeenCalledWith({
			url: "https://example.test/rss",
			limit: 5,
			label: "Example",
		});
		expect(createManyArticles).toHaveBeenCalledWith([
			{
				providerId: "provider-1",
				url: "https://example.test/article-1",
				title: "Article 1",
				content: "Content 1",
				description: null,
				publishedAt: new Date("2026-08-17T01:00:00.000Z"),
			},
		]);
	});

	it("snapshots every article the fetch saw, new and already known alike", async () => {
		fetchLatest.mockResolvedValue([rawArticle(1), rawArticle(2)]);
		// The second article was already stored by an earlier fetch job, so the
		// insert does not return it — it still belongs to this job's snapshot.
		createManyArticles.mockResolvedValue([{ id: "article-1" }]);
		findByProviderAndUrls.mockResolvedValue([
			{ id: "article-1" },
			{ id: "article-2" },
		]);

		const observed = await ingest();

		expect(findByProviderAndUrls).toHaveBeenCalledWith("provider-1", [
			"https://example.test/article-1",
			"https://example.test/article-2",
		]);
		expect(snapshots).toEqual([
			{
				table: schema.providerFetchJobArticles,
				rows: [
					{ providerFetchJobId: PROVIDER_FETCH_JOB_ID, articleId: "article-1" },
					{ providerFetchJobId: PROVIDER_FETCH_JOB_ID, articleId: "article-2" },
				],
			},
		]);
		expect(onConflictDoNothing).toHaveBeenCalledOnce();
		expect(touchLastFetchedAt).toHaveBeenCalledWith("provider-1");
		expect(observed).toBe(2);
	});

	it("asks the connector for the number of articles the provider is set to", async () => {
		await ingest(provider({ fetchLimit: 20 }));

		expect(fetchLatest).toHaveBeenCalledWith(
			expect.objectContaining({ limit: 20 }),
		);
	});

	it("falls back on a default limit for a provider that sets none", async () => {
		await ingest(provider({ fetchLimit: null }));

		expect(fetchLatest).toHaveBeenCalledWith(
			expect.objectContaining({ limit: 5 }),
		);
	});

	it("writes no empty snapshot when the feed had nothing to offer", async () => {
		fetchLatest.mockResolvedValue([]);
		createManyArticles.mockResolvedValue([]);
		findByProviderAndUrls.mockResolvedValue([]);

		const observed = await ingest();

		expect(db.insert).not.toHaveBeenCalled();
		// The fetch did happen: the provider is marked as visited all the same,
		// otherwise a quiet feed would look overdue at every run.
		expect(touchLastFetchedAt).toHaveBeenCalledWith("provider-1");
		expect(observed).toBe(0);
	});

	it("refuses a provider no connector can read", async () => {
		getConnectorMock.mockReturnValue(undefined);

		await expect(ingest()).rejects.toMatchObject({
			code: "NO_CONNECTOR",
			message: expect.stringContaining('provider "example"'),
		});
		expect(createManyArticles).not.toHaveBeenCalled();
		expect(touchLastFetchedAt).not.toHaveBeenCalled();
	});

	it("leaves the provider untouched when the fetch itself fails", async () => {
		fetchLatest.mockRejectedValue(
			new InternalError({ code: "CONNECTOR_TIMEOUT" }),
		);

		await expect(ingest()).rejects.toBeInstanceOf(InternalError);
		expect(createManyArticles).not.toHaveBeenCalled();
		expect(touchLastFetchedAt).not.toHaveBeenCalled();
	});
});
