import {
	TELEGRAM_PAIRING_CODE_ALPHABET,
	TELEGRAM_PAIRING_CODE_LENGTH,
	TELEGRAM_PAIRING_CODE_REDIS_PREFIX,
	TELEGRAM_PAIRING_CODE_TTL_SECONDS,
	TELEGRAM_PAIRING_STATUS,
} from "@brief/common/constants";
import { and, eq, ne, schema } from "@brief/drizzle";
import type { RedisClient } from "@brief/infra/redis";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	asDatabase,
	fakeTransaction,
	recordingChain,
} from "../../testing/db.fake.js";
import type { TelegramClient } from "./telegram.client.js";
import { optOutPairing, TelegramPairingService } from "./telegram.service.js";

const USER_ID = "user-1";
const CHAT_ID = "123456789";
const CODE = "ABCD234XYZ";
const UPDATE_ID = "555";
const RECEIVED_AT = new Date("2026-08-17T06:30:00.000Z");
const NOW = new Date("2026-08-17T07:00:00.000Z");
const KEY = `${TELEGRAM_PAIRING_CODE_REDIS_PREFIX}${CODE}`;

const CONSENT = "J'accepte de recevoir mes briefs sur Telegram.";

const config = { botToken: "123:ABC", botUsername: "dailybriefs_bot" };

type Rows = {
	/** What Redis holds under the pairing key. */
	pending?: string | null;
	/** The pairing the relational query finds, if any. */
	pairing?: Record<string, unknown>;
};

const harness = (rows: Rows = {}) => {
	const redis = {
		set: vi.fn().mockResolvedValue("OK"),
		get: vi.fn().mockResolvedValue(rows.pending ?? null),
		del: vi.fn().mockResolvedValue(1),
	};
	const client = { sendMessage: vi.fn().mockResolvedValue({ ok: true }) };
	const findFirst = vi.fn().mockResolvedValue(rows.pairing);

	const insert = recordingChain();
	const remove = recordingChain();
	const update = recordingChain();
	/** Written after the transaction commits, so the order is observable. */
	const order: string[] = [];

	const tx = {
		insert: (table: unknown) => {
			order.push("insert");
			return insert.insert(table);
		},
		delete: (table: unknown) => {
			order.push("delete");
			return remove.delete(table);
		},
		update: (table: unknown) => update.update(table),
	};

	const db = asDatabase({
		...tx,
		...fakeTransaction(tx),
		query: { telegramPairings: { findFirst } },
	});

	redis.del.mockImplementation(() => {
		order.push("redis.del");
		return Promise.resolve(1);
	});

	return {
		redis,
		client,
		findFirst,
		insert,
		remove,
		update,
		order,
		db,
		service: new TelegramPairingService(
			db,
			redis as unknown as RedisClient,
			config,
			client as unknown as TelegramClient,
		),
	};
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

describe("startPairing", () => {
	it("parks the pairing in Redis with the consent it will have to prove", async () => {
		// The wording is evidence and the webhook has no other way to learn it, so
		// it travels with the code rather than being reconstructed later.
		const { service, redis } = harness();

		const { code } = await service.startPairing({
			userId: USER_ID,
			locale: "fr",
			consentText: CONSENT,
		});

		expect(redis.set).toHaveBeenCalledWith(
			`${TELEGRAM_PAIRING_CODE_REDIS_PREFIX}${code}`,
			JSON.stringify({ userId: USER_ID, locale: "fr", consentText: CONSENT }),
			"EX",
			TELEGRAM_PAIRING_CODE_TTL_SECONDS,
		);
	});

	it("hands out a code a reader can type by hand", async () => {
		const { service } = harness();

		const { code } = await service.startPairing({
			userId: USER_ID,
			locale: "fr",
			consentText: CONSENT,
		});

		expect(code).toHaveLength(TELEGRAM_PAIRING_CODE_LENGTH);
		// No lookalike pairs: the manual fallback is typing `/start CODE`.
		for (const character of code) {
			expect(TELEGRAM_PAIRING_CODE_ALPHABET).toContain(character);
		}
	});
});

describe("buildPairingUrl", () => {
	it("builds the deep link that opens the bot with a Start button", () => {
		const { service } = harness();

		expect(service.buildPairingUrl(CODE)).toBe(
			`https://t.me/${config.botUsername}?start=${CODE}`,
		);
	});
});

describe("findPairing", () => {
	it("reads the status and the opt-in date of a reader's pairing", async () => {
		const pairing = {
			status: TELEGRAM_PAIRING_STATUS.VERIFIED,
			optInAt: RECEIVED_AT,
		};
		const { service, findFirst } = harness({ pairing });

		await expect(service.findPairing({ userId: USER_ID })).resolves.toBe(
			pairing,
		);
		expect(findFirst).toHaveBeenCalledWith({
			columns: { status: true, optInAt: true },
			where: { userId: USER_ID },
		});
	});

	it("returns nothing for a reader who never paired", async () => {
		const { service } = harness({ pairing: undefined });

		await expect(
			service.findPairing({ userId: USER_ID }),
		).resolves.toBeUndefined();
	});
});

describe("confirmPairing", () => {
	const confirm = (service: TelegramPairingService) =>
		service.confirmPairing({
			code: CODE,
			chatId: CHAT_ID,
			updateId: UPDATE_ID,
			receivedAt: RECEIVED_AT,
		});

	const pending = JSON.stringify({
		userId: USER_ID,
		locale: "fr",
		consentText: CONSENT,
	});

	it("records the pairing and reports who paired", async () => {
		const { service, insert, redis } = harness({ pending });

		await expect(confirm(service)).resolves.toEqual({
			outcome: "paired",
			userId: USER_ID,
			locale: "fr",
		});

		expect(redis.get).toHaveBeenCalledWith(KEY);
		expect(redis.del).toHaveBeenCalledWith(KEY);

		expect(insert.args("values")).toEqual([
			{
				userId: USER_ID,
				chatId: CHAT_ID,
				status: TELEGRAM_PAIRING_STATUS.VERIFIED,
				locale: "fr",
				optInAt: RECEIVED_AT,
				optInUpdateId: UPDATE_ID,
				// The wording the reader agreed to, verbatim: `/start CODE` would
				// look like an audit trail while proving nothing.
				optInText: CONSENT,
			},
		]);
	});

	it("takes the chat over from an older account that claimed it", async () => {
		// A `/start` from this chat proves present control of it. Without the
		// transfer the unique constraint would lock the new account out for good.
		const { service, remove } = harness({ pending });

		await confirm(service);

		expect(remove.args("where")).toEqual([
			and(
				eq(schema.telegramPairings.chatId, CHAT_ID),
				ne(schema.telegramPairings.userId, USER_ID),
			),
		]);
	});

	it("lifts an earlier opt-out when the reader pairs again", async () => {
		const { service, insert } = harness({ pending });

		await confirm(service);

		expect(insert.args("onConflictDoUpdate")).toEqual([
			{
				target: schema.telegramPairings.userId,
				set: {
					chatId: CHAT_ID,
					status: TELEGRAM_PAIRING_STATUS.VERIFIED,
					locale: "fr",
					optInAt: RECEIVED_AT,
					optInUpdateId: UPDATE_ID,
					optInText: CONSENT,
					optedOutAt: null,
				},
			},
		]);
	});

	it("only burns the code once the pairing is committed", async () => {
		// Crashing in between leaves a code the reader can replay; deleting first
		// would lose the pairing for good.
		const { service, order } = harness({ pending });

		await confirm(service);

		expect(order).toEqual(["delete", "insert", "redis.del"]);
	});

	it("recognises an update Telegram has already delivered", async () => {
		// The code is gone after the first delivery, so the update id is what
		// tells a redelivery apart from a code that never existed.
		const { service, findFirst, insert } = harness({
			pending: null,
			pairing: { userId: USER_ID },
		});

		await expect(confirm(service)).resolves.toEqual({
			outcome: "already-processed",
		});

		expect(findFirst).toHaveBeenCalledWith({
			columns: { userId: true },
			where: { optInUpdateId: UPDATE_ID },
		});
		expect(insert.calls).toEqual([]);
	});

	it("reports an unknown code when nothing matches", async () => {
		// Anyone can message the bot without a code: not an error.
		const { service } = harness({ pending: null, pairing: undefined });

		await expect(confirm(service)).resolves.toEqual({
			outcome: "unknown-code",
		});
	});

	it("treats a corrupted key as no key at all", async () => {
		// A leftover from an older shape must not crash a webhook Telegram will
		// then retry for hours.
		const { service, insert } = harness({ pending: "{not json" });

		await expect(confirm(service)).resolves.toEqual({
			outcome: "unknown-code",
		});
		expect(insert.calls).toEqual([]);
	});

	it("treats a key missing a field as no key at all", async () => {
		const { service } = harness({
			pending: JSON.stringify({ userId: USER_ID, locale: "fr" }),
		});

		await expect(confirm(service)).resolves.toEqual({
			outcome: "unknown-code",
		});
	});

	it("treats a key with a mistyped field as no key at all", async () => {
		const { service } = harness({
			pending: JSON.stringify({
				userId: USER_ID,
				locale: 42,
				consentText: CONSENT,
			}),
		});

		await expect(confirm(service)).resolves.toEqual({
			outcome: "unknown-code",
		});
	});

	it("treats a key holding something that is not an object as no key at all", async () => {
		const { service } = harness({ pending: JSON.stringify("just a string") });

		await expect(confirm(service)).resolves.toEqual({
			outcome: "unknown-code",
		});
	});
});

describe("optOut", () => {
	it("ends the pairing of the chat it came from", async () => {
		const { service, update } = harness();

		await service.optOut({ chatId: CHAT_ID });

		expect(update.args("update")).toEqual([schema.telegramPairings]);
		expect(update.args("set")).toEqual([
			{ status: TELEGRAM_PAIRING_STATUS.OPTED_OUT, optedOutAt: NOW },
		]);
		// Keyed by chat: an opt-out arrives from a chat, not from a session.
		expect(update.args("where")).toEqual([
			eq(schema.telegramPairings.chatId, CHAT_ID),
		]);
	});
});

describe("optOutPairing", () => {
	it("is callable without the service, for the delivery path", async () => {
		// The delivery worker meets a 403 mid-send and has no Redis to give.
		const { db, update } = harness();

		await optOutPairing(db, CHAT_ID);

		expect(update.args("set")).toEqual([
			{ status: TELEGRAM_PAIRING_STATUS.OPTED_OUT, optedOutAt: NOW },
		]);
	});
});

describe("deletePairing", () => {
	it("removes the record of the authorisation, consent included", async () => {
		const { service, remove } = harness();

		await service.deletePairing({ userId: USER_ID });

		expect(remove.args("delete")).toEqual([schema.telegramPairings]);
		expect(remove.args("where")).toEqual([
			eq(schema.telegramPairings.userId, USER_ID),
		]);
	});
});

describe("sendMessage", () => {
	it("passes the message to the client", async () => {
		const { service, client } = harness();

		await service.sendMessage({ chatId: CHAT_ID, text: "C'est fait." });

		expect(client.sendMessage).toHaveBeenCalledWith({
			chatId: CHAT_ID,
			text: "C'est fait.",
		});
	});

	it("swallows a refusal rather than make Telegram retry the webhook", async () => {
		// The pairing is already recorded; losing the acknowledgement is not worth
		// a retried webhook, and the client has already logged the reason.
		const { service, client } = harness();
		client.sendMessage.mockResolvedValue({
			ok: false,
			retryable: false,
			optOut: true,
			status: 403,
		});

		await expect(
			service.sendMessage({ chatId: CHAT_ID, text: "C'est fait." }),
		).resolves.toBeUndefined();
	});
});
