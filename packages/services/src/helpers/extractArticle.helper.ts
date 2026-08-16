import { MAX_ARTICLE_CONTENT_CHARS } from "@brief/common/constants";
import { getLoggerStore } from "@brief/infra/libs";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

const tidy = (text: string) =>
	text
		.replace(/[\t ]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

export const extractArticle = (html: string, url: string) => {
	let text = "";

	try {
		const { document } = parseHTML(html);
		text = tidy(new Readability(document).parse()?.textContent ?? "");
	} catch (err) {
		getLoggerStore().warn({ err, url }, "Failed to extract article content");
	}

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
