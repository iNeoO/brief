/** How many briefs the landing page shows, newest first, all categories mixed. */
export const LATEST_BRIEFS_LIMIT = 6;

/** Page size of the full brief archive. */
export const BRIEFS_PAGE_SIZE = 10;

/**
 * Length of the teaser shown in a brief card. The full script runs to several
 * hundred words, so the list endpoints send this instead — six full briefs on
 * the landing page would otherwise be a payload nobody reads.
 */
export const BRIEF_EXCERPT_MAX_LENGTH = 220;

/**
 * Reading pace used to turn a script into a "3 min" badge. 200 words per
 * minute is the usual figure for silent reading of ordinary prose; the spoken
 * version is slower, but the badge sits next to the text, not the player.
 */
export const BRIEF_WORDS_PER_MINUTE = 200;
