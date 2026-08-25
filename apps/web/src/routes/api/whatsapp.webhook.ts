import { createHmac, timingSafeEqual } from "node:crypto";
import { pinoLogger } from "@brief/infra/libs";
import { extractPairingCode } from "@brief/services";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { env } from "#/config/env";
import { DEFAULT_LOCALE, isLocale } from "#/libs/i18n/config";
import { DICTIONARIES } from "#/libs/i18n/dictionaries";
import { getContainer } from "#/libs/server/container";

const SIGNATURE_HEADER = "x-hub-signature-256";
const SIGNATURE_PREFIX = "sha256=";

/**
 * What a user writes to stop hearing from us. WhatsApp does not enforce a
 * keyword, so this is our own list — kept short, and matched on the whole message
 * so "stop sending the audio one" is not read as an opt-out.
 */
const OPT_OUT_KEYWORDS = new Set(["STOP", "ARRET", "ARRÊT", "UNSUBSCRIBE"]);

const messageSchema = z.object({
	id: z.string(),
	/** E.164 without the `+`. Authoritative: we could not have forged it. */
	from: z.string(),
	/** Seconds since the epoch, as a string. */
	timestamp: z.string(),
	text: z.object({ body: z.string() }).optional(),
});

const statusSchema = z.object({
	status: z.string(),
	recipient_id: z.string(),
	errors: z
		.array(z.object({ code: z.number(), title: z.string().optional() }))
		.optional(),
});

/**
 * Meta sends a great deal more than this. Only the two shapes the pairing needs
 * are described; every other field is dropped, and a payload carrying neither is
 * a no-op rather than an error.
 */
const webhookSchema = z.object({
	entry: z
		.array(
			z.object({
				changes: z
					.array(
						z.object({
							value: z.object({
								messages: z.array(messageSchema).optional(),
								statuses: z.array(statusSchema).optional(),
							}),
						}),
					)
					.optional(),
			}),
		)
		.optional(),
});

type InboundMessage = z.infer<typeof messageSchema>;
type Webhook = z.infer<typeof webhookSchema>;

const changesOf = (payload: Webhook) =>
	(payload.entry ?? []).flatMap((entry) => entry.changes ?? []);

const equalsInConstantTime = (received: Buffer, expected: Buffer) =>
	received.length === expected.length && timingSafeEqual(received, expected);

/**
 * Without this the endpoint would take instructions from anyone who found the
 * URL: it is the only thing standing between a stranger and a row saying a phone
 * number consented.
 */
const hasValidSignature = (body: Buffer, header: string | null) => {
	if (!header?.startsWith(SIGNATURE_PREFIX)) return false;

	const expected = createHmac("sha256", env.WHATSAPP_APP_SECRET)
		.update(body)
		.digest();

	// Invalid hex decodes short, which the length check then rejects.
	const received = Buffer.from(header.slice(SIGNATURE_PREFIX.length), "hex");

	return equalsInConstantTime(received, expected);
};

/**
 * Always 200 once the signature checks out. Meta retries anything else, and a
 * payload we cannot use will not become usable on the second attempt.
 */
const acknowledged = () => new Response(null, { status: 200 });

const forbidden = () => new Response("Forbidden", { status: 403 });

const handleMessage = async ({ id, from, timestamp, text }: InboundMessage) => {
	const body = text?.body;
	if (!body) return;

	const container = getContainer();

	if (OPT_OUT_KEYWORDS.has(body.trim().toUpperCase())) {
		await container.whatsappPairingService.optOut({ phoneNumber: from });
		pinoLogger.info("A WhatsApp recipient opted out");
		return;
	}

	const code = extractPairingCode(body);
	// Anyone can write to our number without ever having asked for a link. That
	// is a conversation, not a failure.
	if (!code) return;

	const result = await container.whatsappPairingService.confirmPairing({
		code,
		phoneNumber: from,
		messageId: id,
		text: body,
		// Cloud API dates the message in seconds; the column is a timestamptz.
		receivedAt: new Date(Number(timestamp) * 1000),
	});

	if (result.outcome !== "paired") {
		pinoLogger.info(
			{ outcome: result.outcome },
			"A WhatsApp message carried a code we could not use",
		);
		return;
	}

	const locale = isLocale(result.locale) ? result.locale : DEFAULT_LOCALE;

	// Free-form text, no template: their message opened a 24h window and we are
	// answering inside it. This never throws — the pairing is already recorded.
	await container.whatsappPairingService.sendPairingConfirmation({
		phoneNumber: from,
		text: DICTIONARIES[locale].auth.profile.whatsapp.acknowledgement,
	});
};

/**
 * The endpoint Meta calls. It is not an accessory of the pairing, it *is* the
 * pairing: the inbound message is what carries both the consent and a phone
 * number we could not have forged.
 */
export const Route = createFileRoute("/api/whatsapp/webhook")({
	server: {
		handlers: {
			// Called once, when the callback URL is registered.
			GET: ({ request }) => {
				const params = new URL(request.url).searchParams;

				const matches = equalsInConstantTime(
					Buffer.from(params.get("hub.verify_token") ?? ""),
					Buffer.from(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN),
				);

				if (params.get("hub.mode") !== "subscribe" || !matches) {
					return forbidden();
				}

				return new Response(params.get("hub.challenge") ?? "", {
					headers: { "Content-Type": "text/plain" },
				});
			},

			POST: async ({ request }) => {
				// The exact bytes Meta signed. Decoding to a string first and
				// re-encoding would put the signature at the mercy of the round trip.
				const body = Buffer.from(await request.arrayBuffer());

				if (!hasValidSignature(body, request.headers.get(SIGNATURE_HEADER))) {
					pinoLogger.warn(
						"Rejected a WhatsApp webhook carrying an invalid signature",
					);
					return forbidden();
				}

				let payload: Webhook;

				try {
					payload = webhookSchema.parse(JSON.parse(body.toString("utf8")));
				} catch (error) {
					pinoLogger.warn(
						{ err: error },
						"Unreadable WhatsApp webhook payload",
					);
					return acknowledged();
				}

				for (const change of changesOf(payload)) {
					for (const message of change.value.messages ?? []) {
						await handleMessage(message);
					}

					// Delivery statuses belong to the sending work, which does not exist
					// yet. A failure is logged so a wrong number is visible rather than
					// silent, and nothing more.
					for (const status of change.value.statuses ?? []) {
						if (status.status === "failed") {
							pinoLogger.warn(
								{ errors: status.errors },
								"WhatsApp could not deliver a message",
							);
						}
					}
				}

				return acknowledged();
			},
		},
	},
});
