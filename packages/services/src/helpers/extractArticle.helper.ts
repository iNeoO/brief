import { MAX_ARTICLE_CONTENT_CHARS } from "@brief/common/constants";
import { getLoggerStore } from "@brief/infra/libs";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

/** Collapses the whitespace an HTML-to-text pass leaves behind. */
const tidy = (text: string) =>
	text
		.replace(/[\t ]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

/**
 * Pulls the readable article out of a fetched page.
 *
 * A news page is mostly navigation, scripts and trackers: storing it whole
 * costs hundreds of kilobytes per article, and feeding that to the model blows
 * the context window long before the brief is written.
 */
export const extractArticle = (html: string, url: string) => {
	let text = "";

	try {
		const { document } = parseHTML(html);
		text = tidy(new Readability(document).parse()?.textContent ?? "");
	} catch (err) {
		getLoggerStore().warn({ err, url }, "Failed to extract article content");
	}

	// Readability gives up on pages it does not recognise as articles. Falling
	// back to the stripped body keeps something usable rather than nothing.
	if (!text) {
		text = tidy(
			html
				.replace(/<script[\s\S]*?<\/script>/gi, " ")
				.replace(/<style[\s\S]*?<\/style>/gi, " ")
				.replace(/<[^>]+>/g, " "),
		);
	}

	return text.length > MAX_ARTICLE_CONTENT_CHARS
		? `${text.slice(0, MAX_ARTICLE_CONTENT_CHARS)}…`
		: text;
};
