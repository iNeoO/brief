import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { env } from "#/config/env";
import { LOCALES } from "#/libs/i18n/config";
import { DICTIONARIES } from "#/libs/i18n/dictionaries";
import { authedMiddleware } from "#/libs/server/middleware";
import { enforceRateLimit } from "#/libs/server/rate-limit";

/**
 * The pairing state of the signed-in user, and the link that starts one. Nothing
 * here sends a message: the user is the one who starts the conversation, which is
 * what makes the inbound `/start` proof of the chat.
 */

export const TELEGRAM_QUERY_KEY = ["telegram", "pairing"] as const;

export const getTelegramPairing = createServerFn({ method: "GET" })
	.middleware([authedMiddleware])
	.handler(async ({ context }) => {
		const pairing = await context.container.telegramPairingService.findPairing({
			userId: context.user.id,
		});

		// Null rather than undefined: the absence of a pairing is the answer, and it
		// has to survive the trip to the client.
		return { pairing: pairing ?? null };
	});

export const telegramPairingQueryOptions = () =>
	queryOptions({
		queryKey: TELEGRAM_QUERY_KEY,
		queryFn: () => getTelegramPairing(),
	});

/**
 * The locale decides the consent wording, and that wording is the opt-in record.
 * It comes from the request rather than the cookie so the sentence we store is
 * the one the user was actually shown.
 */
const pairingLinkInput = z.object({ locale: z.enum(LOCALES) });

export const createTelegramPairingLink = createServerFn({ method: "POST" })
	.middleware([authedMiddleware])
	.validator(pairingLinkInput)
	.handler(async ({ data, context }) => {
		// Each link mints a code with a lifetime of its own. Minting them in a loop
		// has no legitimate use, and the codes would all stay live at once.
		await enforceRateLimit(
			context.container.redis,
			"createTelegramPairingLink",
			context.user.email,
		);

		// Tapping Start proves control of the account, not agreement. This is the
		// wording the page displays next to the button, and it travels with the code
		// so the webhook can store what the user agreed to, verbatim.
		const consentText = DICTIONARIES[data.locale].auth.profile.telegram.consent;

		const { code } =
			await context.container.telegramPairingService.startPairing({
				userId: context.user.id,
				locale: data.locale,
				consentText,
			});

		return {
			url: context.container.telegramPairingService.buildPairingUrl(code),
			// Returned for the fallback: on a desktop without Telegram the deep link
			// leads nowhere, and `/start CODE` can be typed into the bot by hand.
			botUsername: env.TELEGRAM_BOT_USERNAME,
			code,
		};
	});

export const deleteTelegramPairing = createServerFn({ method: "POST" })
	.middleware([authedMiddleware])
	.handler(async ({ context }) => {
		await context.container.telegramPairingService.deletePairing({
			userId: context.user.id,
		});

		return { success: true };
	});

export const refreshTelegramPairing = (queryClient: QueryClient) =>
	queryClient.invalidateQueries({ queryKey: TELEGRAM_QUERY_KEY });
