import { MAX_ARTICLE_CONTENT_CHARS } from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import { extractArticle } from "./extractArticle.helper.js";

const URL = "https://example.test/article-1";

const page = (body: string) =>
	`<!doctype html><html lang="fr"><head><title>Titre</title></head><body>${body}</body></html>`;

const paragraphs = (count: number, text: string) =>
	Array.from({ length: count }, () => `<p>${text}</p>`).join("");

describe("extractArticle", () => {
	it("keeps the article body and leaves the furniture out", () => {
		const html = page(`
			<nav><a href="/sport">Sport</a><a href="/economie">Économie</a></nav>
			<article>
				${paragraphs(6, "La banque centrale maintient ses taux directeurs inchangés, une décision attendue par les marchés depuis plusieurs semaines.")}
			</article>
			<footer>Tous droits réservés</footer>
		`);

		const text = extractArticle(html, URL);

		expect(text).toContain("La banque centrale maintient ses taux");
		expect(text).not.toContain("Tous droits réservés");
	});

	it("falls back on stripping the markup when there is no page to parse", () => {
		// A bare fragment, as some feeds serve: the reader finds no document to
		// work with and returns nothing, so the tags come off by hand.
		const fragment = `<div>Le texte de l'article</div><p>La suite</p>`;

		expect(extractArticle(fragment, URL)).toBe(
			"Le texte de l'article La suite",
		);
	});

	it("never lets script or style bodies through that fallback", () => {
		const fragment = `
			<script>window.dataLayer = "tracking payload";</script>
			<style>.ad { color: "styling payload"; }</style>
			<div>Le texte</div>
		`;

		const text = extractArticle(fragment, URL);

		expect(text).toBe("Le texte");
	});

	it("collapses the whitespace the markup leaves behind", () => {
		expect(
			extractArticle(
				page("<div>Un   mot \t\t puis\n\n\n\nun autre</div>"),
				URL,
			),
		).toBe("Un mot puis\n\nun autre");
	});

	it("caps a long article and marks the cut", () => {
		const html = page(`<div>${"mot ".repeat(MAX_ARTICLE_CONTENT_CHARS)}</div>`);

		const text = extractArticle(html, URL);

		expect(text).toHaveLength(MAX_ARTICLE_CONTENT_CHARS + 1);
		expect(text.endsWith("…")).toBe(true);
	});

	it("returns nothing rather than throwing on markup it cannot parse", () => {
		expect(extractArticle("", URL)).toBe("");
		expect(extractArticle("<p>unclosed", URL)).toBe("unclosed");
	});
});
