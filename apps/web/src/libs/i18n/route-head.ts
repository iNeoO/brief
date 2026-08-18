import { BRAND_NAME } from "@brief/common/constants";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { DICTIONARIES, type Dictionary } from "./dictionaries";
import { readStoredLocale } from "./locale-cookie";

export const localeLoader = () => ({ locale: readStoredLocale() });

export const localisedTitle =
	(pick: (dictionary: Dictionary) => string) =>
	({ loaderData }: { loaderData?: { locale: Locale } }) => ({
		meta: [
			{
				title: `${pick(DICTIONARIES[loaderData?.locale ?? DEFAULT_LOCALE])} — ${BRAND_NAME}`,
			},
		],
	});
