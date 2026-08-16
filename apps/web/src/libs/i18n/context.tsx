import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { setLocalePreference } from "#/libs/api/preferences";
import type { Locale } from "./config";
import { DICTIONARIES, type Dictionary } from "./dictionaries";

type I18nValue = {
	locale: Locale;
	t: Dictionary;
	setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
	initialLocale,
	children,
}: {
	initialLocale: Locale;
	children: React.ReactNode;
}) {
	const [locale, setLocaleState] = useState(initialLocale);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
		document.documentElement.lang = next;

		void setLocalePreference({ data: { locale: next } });
	}, []);

	const value = useMemo<I18nValue>(
		() => ({ locale, t: DICTIONARIES[locale], setLocale }),
		[locale, setLocale],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
	const value = useContext(I18nContext);

	if (!value) {
		throw new Error("useI18n must be used inside an I18nProvider");
	}

	return value;
}
