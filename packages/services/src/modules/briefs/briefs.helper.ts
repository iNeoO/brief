import {
	BRIEF_EXCERPT_MAX_LENGTH,
	BRIEF_WORDS_PER_MINUTE,
} from "@brief/common/constants";

const countWords = (summary: string) =>
	summary.split(/\s+/).filter(Boolean).length;

/**
 * Rounded up and never zero: a brief short enough to read in forty seconds is
 * still a "1 min" read, not a "0 min" one.
 */
export const readingMinutes = (summary: string) =>
	Math.max(1, Math.round(countWords(summary) / BRIEF_WORDS_PER_MINUTE));

/**
 * The opening of the script, cut on a word boundary so no card ends mid-word.
 * The scripts are plain prose with paragraphs separated by blank lines, so the
 * whitespace is collapsed first — otherwise the teaser carries line breaks
 * into a layout that has no room for them.
 */
export const toExcerpt = (summary: string) => {
	const flattened = summary.replace(/\s+/g, " ").trim();

	if (flattened.length <= BRIEF_EXCERPT_MAX_LENGTH) return flattened;

	const cut = flattened.slice(0, BRIEF_EXCERPT_MAX_LENGTH);
	const lastSpace = cut.lastIndexOf(" ");

	// A single word longer than the limit has no space to cut on; keep the hard
	// cut rather than returning an empty teaser.
	return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

/**
 * The name the browser saves the audio under. Built from the category and the
 * day rather than reusing the stored `<jobId>-<language>.mp3`, which means
 * nothing in a download folder. Accents are folded and everything outside
 * `[a-z0-9-]` is dropped, so the result is safe in a `Content-Disposition`
 * header without any quoting.
 */
export const toAudioFilename = (categoryName: string, targetDate: Date) => {
	const slug =
		categoryName
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || "brief";

	return `${slug}-${targetDate.toISOString().slice(0, 10)}.mp3`;
};

/** The script's paragraphs, for a renderer that emits one node per paragraph. */
export const toParagraphs = (summary: string) =>
	summary
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);

/**
 * The `sources` field the writer returns, one article per line as
 * `<rank>. <title> — <url>`. The URL is greedy on the right so a title that
 * contains a dash keeps it, and the scheme is part of the pattern: this text
 * comes from a model, and only an http(s) link may end up in an `href`.
 */
const SOURCE_LINE = /^\s*(\d+)\s*[.)]?\s+(.+?)\s+[—–-]\s+(https?:\/\/\S+)\s*$/;

export const parseSourceLines = (sources: string | null | undefined) => {
	if (!sources) return [];

	return sources
		.split("\n")
		.map((line) => SOURCE_LINE.exec(line))
		.filter((match) => match !== null)
		.map(([, rank, title, url]) => ({
			rank: Number(rank),
			title: title.trim(),
			url,
		}));
};

/**
 * Lines the script's paragraphs up with the articles behind them, so each
 * story can carry its own source instead of pushing every link to the bottom
 * of the page.
 *
 * The pairing is ordinal — the prompt writes the stories in the order it lists
 * the sources — so it is only trusted when the counts match exactly. A model
 * that silently skipped an unusable article leaves `aligned` false, and the
 * page falls back to a single list of sources rather than attributing a
 * paragraph to the wrong article.
 */
export const toBriefScript = <TSource>(
	summary: string,
	sources: TSource[],
): {
	opening: string | null;
	headlines: string | null;
	stories: { paragraph: string; source: TSource | null }[];
	closing: string | null;
	aligned: boolean;
} => {
	const paragraphs = toParagraphs(summary);

	// Too short to hold the opening/stories/closing structure: render it flat
	// rather than reading a shape into it that is not there.
	if (paragraphs.length < 3) {
		return {
			opening: null,
			headlines: null,
			stories: paragraphs.map((paragraph) => ({ paragraph, source: null })),
			closing: null,
			aligned: false,
		};
	}

	const middle = paragraphs.slice(1, -1);

	// The headlines paragraph is written only when there are several stories,
	// and it is what makes the middle one paragraph longer than the source list.
	const hasHeadlines =
		sources.length > 1 && middle.length === sources.length + 1;
	const storyParagraphs = hasHeadlines ? middle.slice(1) : middle;
	const aligned =
		sources.length > 0 && storyParagraphs.length === sources.length;

	return {
		opening: paragraphs[0] ?? null,
		headlines: hasHeadlines ? (middle[0] ?? null) : null,
		stories: storyParagraphs.map((paragraph, index) => ({
			paragraph,
			source: aligned ? (sources[index] ?? null) : null,
		})),
		closing: paragraphs[paragraphs.length - 1] ?? null,
		aligned,
	};
};
