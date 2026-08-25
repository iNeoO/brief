import { describe, expect, it } from "vitest";
import { canonicalizeUrl } from "./url.helper.js";

/**
 * The canonical url is the deduplication key of `articles`: two fetches of the
 * same page must land on the same string, and two different pages never on one.
 */
describe("canonicalizeUrl", () => {
	it("keeps an already canonical url as it is", () => {
		expect(canonicalizeUrl("https://example.test/article-1")).toBe(
			"https://example.test/article-1",
		);
	});

	it("drops the tracking parameters and the fragment", () => {
		expect(
			canonicalizeUrl("https://example.test/a?utm_source=rss&id=2#lire"),
		).toBe("https://example.test/a");
	});

	it("drops a trailing slash on a path but keeps the one of the root", () => {
		expect(canonicalizeUrl("https://example.test/a/b/")).toBe(
			"https://example.test/a/b",
		);
		expect(canonicalizeUrl("https://example.test/")).toBe(
			"https://example.test/",
		);
	});

	it("resolves a relative link against the feed url", () => {
		expect(canonicalizeUrl("/article-1", "https://example.test/rss")).toBe(
			"https://example.test/article-1",
		);
	});

	it("normalizes the host but not the path, which is case sensitive", () => {
		expect(canonicalizeUrl("https://Example.TEST/Article")).toBe(
			"https://example.test/Article",
		);
	});

	it("leaves a url it cannot parse alone, trimmed", () => {
		expect(canonicalizeUrl("  not a url  ")).toBe("not a url");
		expect(canonicalizeUrl("")).toBe("");
	});

	it("refuses to rewrite anything that is not http(s)", () => {
		// Rewriting these would hand a `javascript:` or `data:` payload back as a
		// clean-looking article url; they stay verbatim and get stored as junk.
		expect(canonicalizeUrl(" javascript:alert(1) ")).toBe(
			"javascript:alert(1)",
		);
		expect(canonicalizeUrl("mailto:redaction@example.test")).toBe(
			"mailto:redaction@example.test",
		);
	});
});
