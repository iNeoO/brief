import { type PageHeadInput, pageHead } from "#/libs/seo/page-head";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { DICTIONARIES, type Dictionary } from "./dictionaries";
import { readStoredLocale } from "./locale-cookie";

export const localeLoader = () => ({ locale: readStoredLocale() });

/**
 * The language a `head` should speak, from whatever its loader returned. It
 * cannot come from the i18n provider: `head` runs before any component, and a
 * title rendered server-side in the wrong language is what a crawler indexes.
 */
export const headDictionary = (loaderData?: { locale: Locale }) => {
	const locale = loaderData?.locale ?? DEFAULT_LOCALE;

	return { locale, t: DICTIONARIES[locale] };
};

/**
 * A page whose metadata needs nothing but the dictionary. A page that also
 * reads its own loader data — the archive's page number, a brief's script —
 * builds its head inline from `headDictionary` and `pageHead` instead.
 */
export const localisedHead =
	(build: (dictionary: Dictionary) => Omit<PageHeadInput, "locale">) =>
	({ loaderData }: { loaderData?: { locale: Locale } }) => {
		const { locale, t } = headDictionary(loaderData);

		return pageHead({ ...build(t), locale });
	};
