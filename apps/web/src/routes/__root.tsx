import interCss from "@fontsource-variable/inter/wght.css?url";
import interTightCss from "@fontsource-variable/inter-tight/wght.css?url";
import {
	ColorSchemeScript,
	MantineProvider,
	mantineHtmlProps,
} from "@mantine/core";
import mantineCss from "@mantine/core/styles.css?url";
import { Notifications } from "@mantine/notifications";
import notificationsCss from "@mantine/notifications/styles.css?url";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { NotFound } from "#/components/not-found/not-found";
import { sessionQueryOptions } from "#/libs/api/auth";
import { DEFAULT_LOCALE } from "#/libs/i18n/config";
import { I18nProvider } from "#/libs/i18n/context";
import { DICTIONARIES } from "#/libs/i18n/dictionaries";
import { readStoredLocale } from "#/libs/i18n/locale-cookie";
import { siteJsonLd } from "#/libs/seo/json-ld";
import { jsonLdScripts, siteDefaultsHead } from "#/libs/seo/page-head";
import { theme } from "#/libs/theme";

import appCss from "../styles.css?url";

const LIGHT_THEME_COLOR = "#ffffff";
const DARK_THEME_COLOR = "#1b1e24";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(sessionQueryOptions());

		return { locale: readStoredLocale() };
	},
	head: ({ loaderData }) => {
		const locale = loaderData?.locale ?? DEFAULT_LOCALE;
		const dictionary = DICTIONARIES[locale];

		return {
			meta: [
				{ charSet: "utf-8" },
				{ name: "viewport", content: "width=device-width, initial-scale=1" },
				{ name: "color-scheme", content: "light dark" },
				...siteDefaultsHead({
					title: dictionary.meta.title,
					description: dictionary.meta.description,
					locale,
				}),
			],
			links: [
				{ rel: "stylesheet", href: interCss },
				{ rel: "stylesheet", href: interTightCss },
				{ rel: "stylesheet", href: mantineCss },
				{ rel: "stylesheet", href: notificationsCss },
				{ rel: "stylesheet", href: appCss },
				{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
				{ rel: "icon", href: "/favicon.ico", sizes: "32x32" },
				{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
				{ rel: "manifest", href: "/site.webmanifest" },
			],
			scripts: jsonLdScripts([
				siteJsonLd({ locale, description: dictionary.meta.description }),
			]),
		};
	},
	notFoundComponent: NotFound,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const { locale } = Route.useLoaderData();

	return (
		<html lang={locale} {...mantineHtmlProps}>
			<head>
				<ColorSchemeScript defaultColorScheme="auto" />

				<meta
					name="theme-color"
					content={LIGHT_THEME_COLOR}
					media="(prefers-color-scheme: light)"
				/>
				<meta
					name="theme-color"
					content={DARK_THEME_COLOR}
					media="(prefers-color-scheme: dark)"
				/>

				<HeadContent />
			</head>
			<body>
				<MantineProvider theme={theme} defaultColorScheme="auto">
					<Notifications position="top-right" limit={3} />

					<I18nProvider initialLocale={locale}>{children}</I18nProvider>
				</MantineProvider>

				<Scripts />
			</body>
		</html>
	);
}
