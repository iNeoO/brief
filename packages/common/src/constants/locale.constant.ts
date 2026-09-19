/**
 * The language the *interface* speaks to a reader in — distinct from `LANGUAGE`,
 * which is the language a category's brief is written and voiced in. A French
 * reader can follow an English topic: the chrome around the brief follows this,
 * the brief itself follows its category.
 *
 * Here rather than in `apps/web` because a worker composes Telegram captions and
 * cannot import the web dictionaries. `apps/web/src/libs/i18n/config.ts`
 * re-exports these so the two cannot drift.
 */
export const LOCALE = {
	EN: "en",
	FR: "fr",
} as const;

export const LOCALES = [LOCALE.EN, LOCALE.FR] as const;

export const DEFAULT_LOCALE = LOCALE.EN;
