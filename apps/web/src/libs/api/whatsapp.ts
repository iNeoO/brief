import { type QueryClient, queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { env } from "#/config/env";
import { LOCALES } from "#/libs/i18n/config";
import { DICTIONARIES } from "#/libs/i18n/dictionaries";
import { authedMiddleware } from "#/libs/server/middleware";
import { enforceAuthRateLimit } from "#/libs/server/rate-limit";

/**
 * The pairing state of the signed-in user, and the link that starts one. Nothing
 * here sends a message: the user is the one who writes to us, which is what makes
 * the inbound message proof of both the consent and the number.
 */

export const WHATSAPP_QUERY_KEY = ["whatsapp", "pairing"] as const;

export const getWhatsappPairing = createServerFn({ method: "GET" })
	.middleware([authedMiddleware])
	.handler(async ({ context }) => {
		const pairing = await context.container.whatsappPairingService.findPairing({
			userId: context.user.id,
		});

		// Null rather than undefined: the absence of a pairing is the answer, and it
		// has to survive the trip to the client.
		return { pairing: pairing ?? null };
	});

export const whatsappPairingQueryOptions = () =>
	queryOptions({
		queryKey: WHATSAPP_QUERY_KEY,
		queryFn: () => getWhatsappPairing(),
	});

/**
 * The locale decides the wording of the sentence the user is about to send, and
 * that sentence is the opt-in record. It comes from the request rather than the
 * cookie so the message matches the page the user is looking at.
 */
const pairingLinkInput = z.object({ locale: z.enum(LOCALES) });

export const createWhatsappPairingLink = createServerFn({ method: "POST" })
	.middleware([authedMiddleware])
	.validator(pairingLinkInput)
	.handler(async ({ data, context }) => {
		// Each link mints a code with a lifetime of its own. Minting them in a loop
		// has no legitimate use, and the codes would all stay live at once.
		await enforceAuthRateLimit(
			context.container.redis,
			"createWhatsappPairingLink",
			context.user.email,
		);

		const { code } =
			await context.container.whatsappPairingService.startPairing({
				userId: context.user.id,
				locale: data.locale,
			});

		const message =
			DICTIONARIES[data.locale].auth.profile.whatsapp.consentMessage(code);

		return {
			url: context.container.whatsappPairingService.buildPairingUrl(message),
			// Returned so the page can show what to send if WhatsApp never opened —
			// on a desktop without WhatsApp installed, the link leads nowhere useful.
			message,
			senderNumber: env.WHATSAPP_SENDER_NUMBER,
		};
	});

export const deleteWhatsappPairing = createServerFn({ method: "POST" })
	.middleware([authedMiddleware])
	.handler(async ({ context }) => {
		await context.container.whatsappPairingService.deletePairing({
			userId: context.user.id,
		});

		return { success: true };
	});

export const refreshWhatsappPairing = (queryClient: QueryClient) =>
	queryClient.invalidateQueries({ queryKey: WHATSAPP_QUERY_KEY });
