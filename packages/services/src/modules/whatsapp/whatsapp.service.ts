import {
	WHATSAPP_PAIRING_CODE_REDIS_PREFIX,
	WHATSAPP_PAIRING_CODE_TTL_SECONDS,
	WHATSAPP_PAIRING_STATUS,
} from "@brief/common/constants";
import { and, type Database, eq, ne, schema } from "@brief/drizzle";
import { getLoggerStore } from "@brief/infra/libs";
import type { RedisClient } from "@brief/infra/redis";
import { generatePairingCode } from "./whatsapp.helper.js";
import type {
	ConfirmPairingInput,
	ConfirmPairingResult,
	PairingCode,
	PairingSummary,
	StartPairingInput,
	WhatsAppConfig,
} from "./whatsapp.type.js";

/** A courtesy reply must never be what holds up a webhook. */
const REPLY_TIMEOUT_MS = 5_000;

/**
 * The value under a pairing key. Anything else there is treated as no key at all:
 * a leftover from an older shape must not crash a webhook Meta will then retry.
 */
const parsePendingPairing = (raw: string | null) => {
	if (!raw) return undefined;

	try {
		const parsed: unknown = JSON.parse(raw);

		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"userId" in parsed &&
			typeof parsed.userId === "string" &&
			"locale" in parsed &&
			typeof parsed.locale === "string"
		) {
			return { userId: parsed.userId, locale: parsed.locale };
		}
	} catch {
		// falls through to undefined
	}

	return undefined;
};

/**
 * Pairing is the user writing to us, not us writing to the user: the inbound
 * message carries both the consent and a phone number we could not have forged.
 * Nothing here sends anything before the user has agreed — the only outbound call
 * is the reply that acknowledges a pairing that already happened.
 */
export class WhatsAppPairingService {
	constructor(
		private db: Database,
		private redis: RedisClient,
		private config: WhatsAppConfig,
	) {}

	/**
	 * Hands out the code the user is about to send us. It lives in Redis and
	 * nowhere else: an abandoned pairing then expires on its own, and the database
	 * never holds a waiting state to clean up.
	 */
	async startPairing({
		userId,
		locale,
	}: StartPairingInput): Promise<PairingCode> {
		const code = generatePairingCode();

		await this.redis.set(
			`${WHATSAPP_PAIRING_CODE_REDIS_PREFIX}${code}`,
			JSON.stringify({ userId, locale }),
			"EX",
			WHATSAPP_PAIRING_CODE_TTL_SECONDS,
		);

		return { code };
	}

	/**
	 * The message is prefilled, not sent: `wa.me` opens WhatsApp with it in the
	 * composer and the user presses send. Composing the sentence is the caller's
	 * job — it is user-facing copy, so it belongs to the locale, not here.
	 */
	buildPairingUrl(message: string) {
		return `https://wa.me/${this.config.senderNumber}?text=${encodeURIComponent(message)}`;
	}

	findPairing({
		userId,
	}: {
		userId: string;
	}): Promise<PairingSummary | undefined> {
		return this.db.query.whatsappPairings.findFirst({
			columns: { phoneNumber: true, status: true, optInAt: true },
			where: { userId },
		});
	}

	async confirmPairing({
		code,
		phoneNumber,
		messageId,
		text,
		receivedAt,
	}: ConfirmPairingInput): Promise<ConfirmPairingResult> {
		const key = `${WHATSAPP_PAIRING_CODE_REDIS_PREFIX}${code}`;
		const pending = parsePendingPairing(await this.redis.get(key));

		if (!pending) {
			// Meta redelivers a webhook it thinks we did not acknowledge, and the
			// code is gone after the first delivery. Recognising our own message id
			// is what tells a redelivery apart from a code that never existed.
			const existing = await this.db.query.whatsappPairings.findFirst({
				columns: { userId: true },
				where: { optInMessageId: messageId },
			});

			return existing
				? { outcome: "already-processed" }
				: { outcome: "unknown-code" };
		}

		const { userId, locale } = pending;

		await this.db.transaction(async (tx) => {
			// Sending this message proves present control of the number, which
			// outweighs an older row claiming it. Without the transfer the unique
			// constraint would leave a second account unable to pair, for good.
			await tx
				.delete(schema.whatsappPairings)
				.where(
					and(
						eq(schema.whatsappPairings.phoneNumber, phoneNumber),
						ne(schema.whatsappPairings.userId, userId),
					),
				);

			await tx
				.insert(schema.whatsappPairings)
				.values({
					userId,
					phoneNumber,
					status: WHATSAPP_PAIRING_STATUS.VERIFIED,
					optInAt: receivedAt,
					optInMessageId: messageId,
					optInText: text,
				})
				.onConflictDoUpdate({
					target: schema.whatsappPairings.userId,
					set: {
						phoneNumber,
						status: WHATSAPP_PAIRING_STATUS.VERIFIED,
						optInAt: receivedAt,
						optInMessageId: messageId,
						optInText: text,
						// This consent lifts an earlier STOP, and the check
						// constraint ties the timestamp to the status.
						optedOutAt: null,
					},
				});
		});

		await this.redis.del(key);

		return { outcome: "paired", userId, locale };
	}

	/**
	 * Keyed by number rather than by user: a STOP arrives from a phone, and the
	 * account behind it is what we have to look up.
	 */
	async optOut({ phoneNumber }: { phoneNumber: string }) {
		await this.db
			.update(schema.whatsappPairings)
			.set({
				status: WHATSAPP_PAIRING_STATUS.OPTED_OUT,
				optedOutAt: new Date(),
			})
			.where(eq(schema.whatsappPairings.phoneNumber, phoneNumber));
	}

	/** Withdrawing the authorisation removes the record of it, consent included. */
	async deletePairing({ userId }: { userId: string }) {
		await this.db
			.delete(schema.whatsappPairings)
			.where(eq(schema.whatsappPairings.userId, userId));
	}

	/**
	 * Free-form text, no template: the user's message opened a 24h window and we
	 * are answering inside it. Never throws — the pairing is already recorded, and
	 * losing the acknowledgement is not worth making Meta retry the webhook.
	 */
	async sendPairingConfirmation({
		phoneNumber,
		text,
	}: {
		phoneNumber: string;
		text: string;
	}) {
		const logger = getLoggerStore();
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REPLY_TIMEOUT_MS);

		try {
			const response = await fetch(
				`https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`,
				{
					method: "POST",
					headers: {
						authorization: `Bearer ${this.config.accessToken}`,
						"content-type": "application/json",
					},
					body: JSON.stringify({
						messaging_product: "whatsapp",
						recipient_type: "individual",
						to: phoneNumber,
						type: "text",
						text: { body: text },
					}),
					signal: controller.signal,
				},
			);

			if (!response.ok) {
				logger.warn(
					{ status: response.status, body: await response.text() },
					"WhatsApp refused the pairing acknowledgement",
				);
			}
		} catch (error) {
			logger.warn(
				{ err: error },
				"Could not send the WhatsApp pairing acknowledgement",
			);
		} finally {
			clearTimeout(timeout);
		}
	}
}
