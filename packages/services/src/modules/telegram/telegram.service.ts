import {
	TELEGRAM_PAIRING_CODE_REDIS_PREFIX,
	TELEGRAM_PAIRING_CODE_TTL_SECONDS,
	TELEGRAM_PAIRING_STATUS,
} from "@brief/common/constants";
import { and, type Database, eq, ne, schema } from "@brief/drizzle";
import type { RedisClient } from "@brief/infra/redis";
import type { TelegramClient } from "./telegram.client.js";
import { generatePairingCode } from "./telegram.helper.js";
import type {
	ConfirmPairingInput,
	ConfirmPairingResult,
	PairingCode,
	PairingSummary,
	StartPairingInput,
	TelegramConfig,
} from "./telegram.type.js";

/**
 * Ends a pairing, keyed by chat rather than by user: an opt-out arrives from a
 * chat — `/stop`, a block, or a `403` met while sending — and the account behind
 * it is what we have to look up.
 *
 * A free function so the delivery path can call it without constructing
 * `TelegramPairingService`, which needs Redis it would never use. One write, one
 * implementation.
 */
export const optOutPairing = async (db: Database, chatId: string) => {
	await db
		.update(schema.telegramPairings)
		.set({
			status: TELEGRAM_PAIRING_STATUS.OPTED_OUT,
			optedOutAt: new Date(),
		})
		.where(eq(schema.telegramPairings.chatId, chatId));
};

/**
 * The value under a pairing key. Anything else there is treated as no key at all:
 * a leftover from an older shape must not crash a webhook Telegram will then
 * retry.
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
			typeof parsed.locale === "string" &&
			"consentText" in parsed &&
			typeof parsed.consentText === "string"
		) {
			return {
				userId: parsed.userId,
				locale: parsed.locale,
				consentText: parsed.consentText,
			};
		}
	} catch {
		// falls through to undefined
	}

	return undefined;
};

/**
 * Pairing is the user starting a conversation with the bot, not us starting one:
 * the `/start` carries a chat id we could not have forged, and Telegram will not
 * let a bot write to a chat that never wrote to it.
 *
 * Consent does **not** come with the message — tapping Start proves control of the
 * account and nothing more. The wording the user agreed to is shown on our page,
 * carried through Redis with the code, and stored verbatim as `optInText`. Storing
 * `/start CODE` there instead would look like an audit trail while proving
 * nothing.
 */
export class TelegramPairingService {
	constructor(
		private db: Database,
		private redis: RedisClient,
		private config: TelegramConfig,
		private client: TelegramClient,
	) {}

	/**
	 * Hands out the code the user is about to send us. It lives in Redis and
	 * nowhere else: an abandoned pairing then expires on its own, and the database
	 * never holds a waiting state to clean up. The consent wording rides along —
	 * it is the evidence, and the webhook has no other way to learn it.
	 */
	async startPairing({
		userId,
		locale,
		consentText,
	}: StartPairingInput): Promise<PairingCode> {
		const code = generatePairingCode();

		await this.redis.set(
			`${TELEGRAM_PAIRING_CODE_REDIS_PREFIX}${code}`,
			JSON.stringify({ userId, locale, consentText }),
			"EX",
			TELEGRAM_PAIRING_CODE_TTL_SECONDS,
		);

		return { code };
	}

	/**
	 * A deep link, not a prefilled message: Telegram opens the bot's chat with a
	 * single Start button, and tapping it sends `/start <code>`. The payload allows
	 * `A-Za-z0-9_-` up to 64 characters, which the pairing alphabet is a subset of.
	 */
	buildPairingUrl(code: string) {
		return `https://t.me/${this.config.botUsername}?start=${code}`;
	}

	findPairing({
		userId,
	}: {
		userId: string;
	}): Promise<PairingSummary | undefined> {
		return this.db.query.telegramPairings.findFirst({
			columns: { status: true, optInAt: true },
			where: { userId },
		});
	}

	async confirmPairing({
		code,
		chatId,
		updateId,
		receivedAt,
	}: ConfirmPairingInput): Promise<ConfirmPairingResult> {
		const key = `${TELEGRAM_PAIRING_CODE_REDIS_PREFIX}${code}`;
		const pending = parsePendingPairing(await this.redis.get(key));

		if (!pending) {
			// Telegram redelivers an update it thinks we did not acknowledge, and the
			// code is gone after the first delivery. Recognising the update id is what
			// tells a redelivery apart from a code that never existed.
			const existing = await this.db.query.telegramPairings.findFirst({
				columns: { userId: true },
				where: { optInUpdateId: updateId },
			});

			return existing
				? { outcome: "already-processed" }
				: { outcome: "unknown-code" };
		}

		const { userId, locale, consentText } = pending;

		await this.db.transaction(async (tx) => {
			// A `/start` from this chat proves present control of it, which outweighs
			// an older row claiming it. Without the transfer the unique constraint
			// would leave a second account unable to pair, for good.
			await tx
				.delete(schema.telegramPairings)
				.where(
					and(
						eq(schema.telegramPairings.chatId, chatId),
						ne(schema.telegramPairings.userId, userId),
					),
				);

			await tx
				.insert(schema.telegramPairings)
				.values({
					userId,
					chatId,
					status: TELEGRAM_PAIRING_STATUS.VERIFIED,
					// Persisted here and nowhere else: this is the only surface that
					// needs to know which language to address the reader in, and the
					// consent is what carries it.
					locale,
					optInAt: receivedAt,
					optInUpdateId: updateId,
					optInText: consentText,
				})
				.onConflictDoUpdate({
					target: schema.telegramPairings.userId,
					set: {
						chatId,
						status: TELEGRAM_PAIRING_STATUS.VERIFIED,
						locale,
						optInAt: receivedAt,
						optInUpdateId: updateId,
						optInText: consentText,
						// This consent lifts an earlier opt-out, and the check
						// constraint ties the timestamp to the status.
						optedOutAt: null,
					},
				});
		});

		await this.redis.del(key);

		return { outcome: "paired", userId, locale };
	}

	async optOut({ chatId }: { chatId: string }) {
		await optOutPairing(this.db, chatId);
	}

	/** Withdrawing the authorisation removes the record of it, consent included. */
	async deletePairing({ userId }: { userId: string }) {
		await this.db
			.delete(schema.telegramPairings)
			.where(eq(schema.telegramPairings.userId, userId));
	}

	/**
	 * Never throws, and deliberately discards the client's verdict — the pairing is
	 * already recorded, and losing the acknowledgement is not worth making Telegram
	 * retry the webhook. `TelegramClient` has already logged whatever went wrong.
	 *
	 * A brief delivery wants the opposite and calls the client directly, so it can
	 * tell a 429 apart from a reader who has blocked the bot.
	 */
	async sendMessage({ chatId, text }: { chatId: string; text: string }) {
		await this.client.sendMessage({ chatId, text });
	}
}
