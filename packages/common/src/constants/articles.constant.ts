/**
 * Ceiling on the article text kept at ingestion. A long news piece runs to a
 * few thousand characters; anything past this is boilerplate the page carried
 * along, and the summary step pays for it in tokens.
 */
export const MAX_ARTICLE_CONTENT_CHARS = 20_000;
