import { BRIEF_EXCERPT_MAX_LENGTH } from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import {
	parseSourceLines,
	readingMinutes,
	toBriefScript,
	toExcerpt,
	toParagraphs,
} from "./briefs.helper.js";

describe("toExcerpt", () => {
	it("returns a short script untouched", () => {
		expect(toExcerpt("Voici le brief du jour.")).toBe(
			"Voici le brief du jour.",
		);
	});

	it("collapses the blank lines that separate paragraphs", () => {
		expect(toExcerpt("Premier paragraphe.\n\nSecond paragraphe.")).toBe(
			"Premier paragraphe. Second paragraphe.",
		);
	});

	it("cuts on a word boundary and never mid-word", () => {
		const excerpt = toExcerpt(`${"mot ".repeat(200)}fin`);

		expect(excerpt.length).toBeLessThanOrEqual(BRIEF_EXCERPT_MAX_LENGTH + 1);
		expect(excerpt.endsWith("…")).toBe(true);
		expect(excerpt).not.toMatch(/mo…$/);
	});

	it("falls back to a hard cut when no space fits in the limit", () => {
		const excerpt = toExcerpt("a".repeat(BRIEF_EXCERPT_MAX_LENGTH + 50));

		expect(excerpt).toBe(`${"a".repeat(BRIEF_EXCERPT_MAX_LENGTH)}…`);
	});
});

describe("readingMinutes", () => {
	it("rounds a very short script up to one minute", () => {
		expect(readingMinutes("Trois mots seulement")).toBe(1);
	});

	it("counts roughly two hundred words a minute", () => {
		expect(readingMinutes("mot ".repeat(600))).toBe(3);
	});
});

describe("parseSourceLines", () => {
	it("reads the rank, the title and the url of every line", () => {
		expect(
			parseSourceLines(
				"0. La banque centrale maintient ses taux — https://example.org/a\n1. Grève des transports — https://example.org/b",
			),
		).toEqual([
			{
				rank: 0,
				title: "La banque centrale maintient ses taux",
				url: "https://example.org/a",
			},
			{ rank: 1, title: "Grève des transports", url: "https://example.org/b" },
		]);
	});

	it("keeps a dash that belongs to the title", () => {
		expect(
			parseSourceLines("0. Jean-Luc Mélenchon — le discours — https://x.org/c"),
		).toEqual([
			{
				rank: 0,
				title: "Jean-Luc Mélenchon — le discours",
				url: "https://x.org/c",
			},
		]);
	});

	it("drops anything that is not an http(s) link", () => {
		expect(
			parseSourceLines(
				"0. Titre — javascript:alert(1)\n1. Autre — ftp://example.org/x\n2. Bon — https://ok.org/d",
			),
		).toEqual([{ rank: 2, title: "Bon", url: "https://ok.org/d" }]);
	});

	it("returns nothing for an empty field", () => {
		expect(parseSourceLines(null)).toEqual([]);
	});
});

describe("toBriefScript", () => {
	const sources = [{ url: "a" }, { url: "b" }];

	it("splits opening, headlines, stories and closing, and pairs the sources", () => {
		const script = toBriefScript(
			[
				"Voici le brief économie du 17 août.",
				"Au sommaire, les taux et la grève.",
				"La banque centrale maintient ses taux.",
				"Les transports sont perturbés.",
				"C'était le brief du jour.",
			].join("\n\n"),
			sources,
		);

		expect(script.opening).toBe("Voici le brief économie du 17 août.");
		expect(script.headlines).toBe("Au sommaire, les taux et la grève.");
		expect(script.closing).toBe("C'était le brief du jour.");
		expect(script.stories.map((story) => story.source)).toEqual(sources);
		expect(script.aligned).toBe(true);
	});

	it("handles the single story, which carries no headlines paragraph", () => {
		const script = toBriefScript("Ouverture.\n\nL'unique sujet.\n\nClôture.", [
			{ url: "a" },
		]);

		expect(script.headlines).toBeNull();
		expect(script.stories).toEqual([
			{ paragraph: "L'unique sujet.", source: { url: "a" } },
		]);
		expect(script.aligned).toBe(true);
	});

	it("attributes nothing when the counts do not line up", () => {
		// Three story paragraphs for two sources: the writer skipped an article,
		// so pairing by position would credit the wrong one.
		const script = toBriefScript(
			"Ouverture.\n\nSommaire.\n\nUn.\n\nDeux.\n\nTrois.\n\nClôture.",
			sources,
		);

		expect(script.aligned).toBe(false);
		expect(script.stories.every((story) => story.source === null)).toBe(true);
		expect(script.stories).toHaveLength(4);
	});

	it("stays flat when the script is too short to have a structure", () => {
		const script = toBriefScript("Une seule phrase.", sources);

		expect(script.opening).toBeNull();
		expect(script.closing).toBeNull();
		expect(script.aligned).toBe(false);
		expect(script.stories).toEqual([
			{ paragraph: "Une seule phrase.", source: null },
		]);
	});
});

describe("toParagraphs", () => {
	it("splits on blank lines and drops the empty pieces", () => {
		expect(toParagraphs("Un.\n\n\n  \n\nDeux.\n\nTrois.\n")).toEqual([
			"Un.",
			"Deux.",
			"Trois.",
		]);
	});
});
