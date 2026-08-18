import { BRAND_NAME } from "@brief/common/constants";
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
import { sessionQueryOptions } from "#/libs/api/auth";
import { DEFAULT_LOCALE } from "#/libs/i18n/config";
import { I18nProvider } from "#/libs/i18n/context";
import { DICTIONARIES } from "#/libs/i18n/dictionaries";
import { readStoredLocale } from "#/libs/i18n/locale-cookie";
import { theme } from "#/libs/theme";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	// The site header greets a signed-in reader with their own links, so the
	// session has to be in the cache before the first render. Better Auth reads
	// it from its cookie cache, and a visitor without a cookie never reaches the
	// database.
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
				{ title: `${BRAND_NAME} — ${dictionary.meta.title}` },
				{ name: "description", content: dictionary.meta.description },
				{ name: "color-scheme", content: "light dark" },
			],
			links: [
				// Fonts and Mantine first: the app stylesheet overrides both.
				{ rel: "stylesheet", href: interCss },
				{ rel: "stylesheet", href: interTightCss },
				{ rel: "stylesheet", href: mantineCss },
				{ rel: "stylesheet", href: notificationsCss },
				{ rel: "stylesheet", href: appCss },
			],
		};
	},
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const { locale } = Route.useLoaderData();

	return (
		<html lang={locale} {...mantineHtmlProps}>
			<head>
				{/* Applies the stored scheme before first paint, so no flash. */}
				<ColorSchemeScript defaultColorScheme="auto" />
				<HeadContent />
			</head>
			<body>
				{/*
				 * No site chrome here: the marketing header belongs to the landing
				 * page, and the auth and signed-in pages carry their own. A shared
				 * shell at this level would show "Sign in / Sign up" to someone who
				 * is already signed in.
				 */}
				<MantineProvider theme={theme} defaultColorScheme="auto">
					{/*
					 * Top-right rather than the default bottom-right, which landed on
					 * the submit button of a centred auth card — the one control
					 * someone wants right after a failure. The offset that clears the
					 * sticky header lives in `styles.css`: setting `top` inline here
					 * fights the `bottom` in Mantine's own position rule and stretches
					 * the container over the whole page, where it eats clicks.
					 */}
					<Notifications position="top-right" limit={3} />

					<I18nProvider initialLocale={locale}>{children}</I18nProvider>
				</MantineProvider>

				<Scripts />
			</body>
		</html>
	);
}
