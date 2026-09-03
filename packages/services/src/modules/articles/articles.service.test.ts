import { and, eq, inArray, schema } from "@brief/drizzle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDatabase, recordingChain } from "../../testing/db.fake.js";
import { ArticlesService } from "./articles.service.js";
import type { CreateManyArticlesParams } from "./articles.type.js";

const PROVIDER_ID = "provider-1";
const CATEGORY_JOB_ID = 42;

const rows = [{ id: "article-1" }, { id: "article-2" }];

const findFirst = vi.fn();
const chain = recordingChain(rows);

/**
 * The chain answers the four queries; `query` is bolted on for the one method
 * that goes through the relational API instead of the builder.
 */
const db = Object.assign(chain, { query: { articles: { findFirst } } });
const service = () => new ArticlesService(asDatabase(db));

beforeEach(() => {
	vi.clearAllMocks();
	chain.calls.length = 0;
});

describe("createManyArticles", () => {
	it("inserts the batch and ignores the urls already stored", async () => {
		const payload = [
			{
				providerId: PROVIDER_ID,
				url: "https://example.test/a",
				title: "Une matinale",
				content: "Le texte de l'article.",
				description: null,
				publishedAt: null,
			},
		] satisfies CreateManyArticlesParams;

		await expect(service().createManyArticles(payload)).resolves.toEqual(rows);

		expect(chain.args("insert")).toEqual([schema.articles]);
		expect(chain.args("values")).toEqual([payload]);
		// A feed republishes the same item every poll: the conflict target is
		// what keeps a re-read from duplicating yesterday's articles.
		expect(chain.args("onConflictDoNothing")).toEqual([
			{ target: [schema.articles.providerId, schema.articles.url] },
		]);
	});

	it("skips the database entirely on an empty batch", async () => {
		// An empty `values()` is a syntax error in postgres, so the guard is the
		// only thing standing between a quiet feed and a failed fetch job.
		await expect(service().createManyArticles([])).resolves.toEqual([]);
		expect(chain.calls).toEqual([]);
	});
});

describe("findByProviderAndUrls", () => {
	it("looks the urls up for that provider only", async () => {
		const urls = ["https://example.test/a", "https://example.test/b"];

		await expect(
			service().findByProviderAndUrls(PROVIDER_ID, urls),
		).resolves.toEqual(rows);

		expect(chain.args("from")).toEqual([schema.articles]);
		expect(chain.args("where")).toEqual([
			and(
				eq(schema.articles.providerId, PROVIDER_ID),
				inArray(schema.articles.url, urls),
			),
		]);
	});

	it("skips the database entirely when asked about no url", async () => {
		// `inArray` with an empty list is invalid SQL, same story as above.
		await expect(
			service().findByProviderAndUrls(PROVIDER_ID, []),
		).resolves.toEqual([]);
		expect(chain.calls).toEqual([]);
	});
});

describe("getObservedArticles", () => {
	it("walks the fetch jobs the category job waited on", async () => {
		await expect(
			service().getObservedArticles(CATEGORY_JOB_ID),
		).resolves.toEqual(rows);

		expect(chain.args("from")).toEqual([schema.categoryJobProviderFetchJobs]);
		expect(
			chain.calls.filter((call) => call.method === "innerJoin"),
		).toHaveLength(2);
		expect(chain.args("where")).toEqual([
			eq(schema.categoryJobProviderFetchJobs.categoryJobId, CATEGORY_JOB_ID),
		]);
	});
});

describe("getArticle", () => {
	it("reads one article by id", async () => {
		findFirst.mockResolvedValue(rows[0]);

		await expect(service().getArticle("article-1")).resolves.toBe(rows[0]);
		expect(findFirst).toHaveBeenCalledWith({ where: { id: "article-1" } });
	});

	it("returns nothing for an id no article carries", async () => {
		findFirst.mockResolvedValue(undefined);

		await expect(service().getArticle("ghost")).resolves.toBeUndefined();
	});
});
