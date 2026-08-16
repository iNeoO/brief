import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import {
	LOCALE_COOKIE,
	LOCALE_COOKIE_MAX_AGE_SECONDS,
	LOCALES,
} from "#/libs/i18n/config";

const localeInput = z.object({ locale: z.enum(LOCALES) });

export const setLocalePreference = createServerFn({ method: "POST" })
	.validator(localeInput)
	.handler(({ data }) => {
		setCookie(LOCALE_COOKIE, data.locale, {
			path: "/",
			maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
			sameSite: "lax",
			httpOnly: false,
			secure: process.env.NODE_ENV === "production",
		});

		return { success: true };
	});
