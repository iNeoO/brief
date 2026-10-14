export const MAX_ARTICLE_CONTENT_CHARS = 20_000;

/**
 * A feed writes its own titles and summaries, and nothing obliges it to keep
 * them short: Atom's `summary` is optional, so `entry.content` — a whole article
 * body — stands in for it. Both figures are generous for the real thing and
 * bound what a single entry can spend, in the database and in the prompt.
 *
 * `description` matters most: `getArticles` returns one per candidate in the
 * selection call, so an unbounded one is multiplied by the day's candidates.
 */
export const MAX_ARTICLE_TITLE_CHARS = 300;
export const MAX_ARTICLE_DESCRIPTION_CHARS = 2_000;
