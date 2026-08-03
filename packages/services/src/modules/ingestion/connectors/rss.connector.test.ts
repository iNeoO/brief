import { InternalError } from "@brief/infra/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchText } from "../../../helpers/fetchText.helper.js";
import { RssConnector } from "./rss.connector.js";

vi.mock("../../../helpers/fetchText.helper.js", () => ({
	fetchText: vi.fn(),
}));

const fetchTextMock = vi.mocked(fetchText);

const FEED_URL = "https://example.test/rss";

const feed = (items: string) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
	<channel>
		<title>Example</title>
		${items}
	</channel>
</rss>`;

const item = (n: number) => `<item>
	<title>Article ${n}</title>
	<link>https://example.test/article-${n}</link>
	<description>Description ${n}</description>
	<pubDate>Mon, 03 Aug 2026 10:0${n}:00 GMT</pubDate>
	<enclosure url="https://example.test/image-${n}.jpg" type="image/jpeg" />
</item>`;

/** Serves the feed for FEED_URL and "<url> body" for anything else. */
const serve = (rss: string) =>
	fetchTextMock.mockImplementation(async ({ url }) =>
		url === FEED_URL ? rss : `${url} body`,
	);

const fetchLatest = (limit = 10) =>
	new RssConnector().fetchLatest({ url: FEED_URL, limit, label: "Example" });

beforeEach(() => {
	fetchTextMock.mockReset();
});

describe("RssConnector", () => {
	it("maps feed items to articles and fetches their content", async () => {
		serve(feed(item(1)));

		const articles = await fetchLatest();

		expect(articles).toEqual([
			{
				url: "https://example.test/article-1",
				title: "Article 1",
				description: "Description 1",
				content: "https://example.test/article-1 body",
				imageUrl: "https://example.test/image-1.jpg",
				publishedAt: new Date("Mon, 03 Aug 2026 10:01:00 GMT"),
			},
		]);
	});

	it("caps the number of articles at the given limit", async () => {
		serve(feed([item(1), item(2), item(3)].join("\n")));

		const articles = await fetchLatest(2);

		expect(articles.map((a) => a.title)).toEqual(["Article 1", "Article 2"]);
	});

	it("ignores items without a link or a title", async () => {
		serve(
			feed(
				[
					item(1),
					"<item><title>No link</title></item>",
					"<item><link>https://example.test/no-title</link></item>",
				].join("\n"),
			),
		);

		const articles = await fetchLatest();

		expect(articles.map((a) => a.title)).toEqual(["Article 1"]);
	});

	it("skips articles whose content cannot be fetched", async () => {
		const rss = feed([item(1), item(2)].join("\n"));
		fetchTextMock.mockImplementation(async ({ url }) => {
			if (url === FEED_URL) return rss;
			if (url.endsWith("article-1")) throw new Error("403");
			return `${url} body`;
		});

		const articles = await fetchLatest();

		expect(articles.map((a) => a.title)).toEqual(["Article 2"]);
	});

	it("labels the feed and article requests with the provider name", async () => {
		serve(feed(item(1)));

		await fetchLatest();

		expect(fetchTextMock).toHaveBeenCalledWith({
			url: FEED_URL,
			context: "Example feed",
		});
		expect(fetchTextMock).toHaveBeenCalledWith({
			url: "https://example.test/article-1",
			context: "Example article",
		});
	});

	it("throws CONNECTOR_PARSE_ERROR when the feed holds no items", async () => {
		serve(feed(""));

		await expect(fetchLatest()).rejects.toThrow(
			expect.objectContaining({ code: "CONNECTOR_PARSE_ERROR" }),
		);
		await expect(fetchLatest()).rejects.toBeInstanceOf(InternalError);
	});
});
