import { InternalError } from "@brief/infra/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchText } from "../../../helpers/fetchText.helper.js";
import { AtomConnector } from "./atom.connector.js";

vi.mock("../../../helpers/fetchText.helper.js", () => ({
	fetchText: vi.fn(),
}));

const fetchTextMock = vi.mocked(fetchText);

const FEED_URL = "https://example.test/atom";

const feed = (entries: string) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<title>Example</title>
	${entries}
</feed>`;

const entry = (n: number, links?: string) => `<entry>
	<title>Article ${n}</title>
	${
		links ??
		`<link rel="alternate" type="text/html" href="https://example.test/article-${n}"/>`
	}
	<summary>Description ${n}</summary>
	<published>2026-08-2${n}T04:00:00Z</published>
	<updated>2026-08-2${n}T06:00:00Z</updated>
</entry>`;

const serve = (atom: string) =>
	fetchTextMock.mockImplementation(async ({ url }) =>
		url === FEED_URL ? atom : `${url} body`,
	);

const fetchLatest = (limit = 10) =>
	new AtomConnector().fetchLatest({ url: FEED_URL, limit, label: "Example" });

beforeEach(() => {
	fetchTextMock.mockReset();
});

describe("AtomConnector", () => {
	it("maps entries to articles and fetches their content", async () => {
		serve(feed(entry(1)));

		const articles = await fetchLatest();

		expect(articles).toEqual([
			{
				url: "https://example.test/article-1",
				title: "Article 1",
				description: "Description 1",
				content: "https://example.test/article-1 body",
				imageUrl: null,
				publishedAt: new Date("2026-08-21T04:00:00Z"),
			},
		]);
	});

	it("takes the alternate link, not the first one", async () => {
		serve(
			feed(
				entry(
					1,
					`<link rel="self" type="application/atom+xml" href="https://example.test/self"/>
					<link rel="alternate" type="text/html" href="https://example.test/article-1"/>`,
				),
			),
		);

		const articles = await fetchLatest();

		expect(articles[0]?.url).toBe("https://example.test/article-1");
	});

	it("falls back to updated when an entry has no published date", async () => {
		serve(
			feed(`<entry>
				<title>Article 1</title>
				<link rel="alternate" href="https://example.test/article-1"/>
				<updated>2026-08-24T06:00:00Z</updated>
			</entry>`),
		);

		const articles = await fetchLatest();

		expect(articles[0]?.publishedAt).toEqual(new Date("2026-08-24T06:00:00Z"));
	});

	it("caps the number of articles at the given limit", async () => {
		serve(feed([entry(1), entry(2), entry(3)].join("\n")));

		const articles = await fetchLatest(2);

		expect(articles.map((a) => a.title)).toEqual(["Article 1", "Article 2"]);
	});

	it("ignores entries without a link or a title", async () => {
		serve(
			feed(
				[
					entry(1),
					"<entry><title>No link</title></entry>",
					'<entry><link rel="alternate" href="https://example.test/no-title"/></entry>',
				].join("\n"),
			),
		);

		const articles = await fetchLatest();

		expect(articles.map((a) => a.title)).toEqual(["Article 1"]);
	});

	it("throws CONNECTOR_PARSE_ERROR when the feed carries no entries at all", async () => {
		// A well-formed document with nothing in it: the parser is happy and the
		// connector still has nothing to ingest, which is a broken feed.
		serve(feed(""));

		await expect(fetchLatest()).rejects.toThrow(
			expect.objectContaining({ code: "CONNECTOR_PARSE_ERROR" }),
		);
	});

	it("throws CONNECTOR_PARSE_ERROR when the document is not Atom", async () => {
		serve('<?xml version="1.0"?><rss version="2.0"><channel/></rss>');

		await expect(fetchLatest()).rejects.toThrow(
			expect.objectContaining({ code: "CONNECTOR_PARSE_ERROR" }),
		);
		await expect(fetchLatest()).rejects.toBeInstanceOf(InternalError);
	});
});
