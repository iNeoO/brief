import { timingSafeEqual } from "node:crypto";
import { getLoggerStore } from "@brief/infra/libs";
import { extractPairingCode } from "@brief/services";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { env } from "#/config/env";
import { DEFAULT_LOCALE, isLocale } from "#/libs/i18n/config";
import { DICTIONARIES } from "#/libs/i18n/dictionaries";
import { getContainer } from "#/libs/server/container";
import { withRequestLogger } from "#/libs/server/logger";

const SECRET_HEADER = "x-telegram-bot-api-secret-token";

/**
 * The command that stops the briefs. Telegram has no enforced keyword, so this is
 * our own — but unlike a free-text keyword it is exact, and `/stop` is what the
 * bot's command list will offer.
 */
const OPT_OUT_COMMAND = "/stop";

/**
 * `kicked` is what Telegram reports when a user blocks the bot — that, rather
 * than a command, is what people actually do, and it is the only notice we get
 * that nothing will ever be delivered again. `left` covers the same thing for a
 * group chat, which a reader can pair from just as well.
 */
const UNREACHABLE_STATUSES = new Set(["kicked", "left"]);

const chatSchema = z.object({ id: z.number() });

const messageSchema = z.object({
	/** Seconds since the epoch. */
	date: z.number(),
	/** Authoritative: the chat the update came from, which we could not forge. */
	chat: chatSchema,
	text: z.string().optional(),
});

const myChatMemberSchema = z.object({
	chat: chatSchema,
	new_chat_member: z.object({ status: z.string() }),
});

/**
 * Telegram sends a great deal more than this. Only the two shapes the pairing
 * needs are described — `allowed_updates` on `setWebhook` asks for those two and
 * nothing else — and an update carrying neither is a no-op rather than an error.
 */
const updateSchema = z.object({
	update_id: z.number(),
	message: messageSchema.optional(),
	my_chat_member: myChatMemberSchema.optional(),
});

type Update = z.infer<typeof updateSchema>;

const equalsInConstantTime = (received: Buffer, expected: Buffer) =>
	received.length === expected.length && timingSafeEqual(received, expected);

/**
 * Without this the endpoint would take instructions from anyone who found the
 * URL: it is the only thing standing between a stranger and a row saying an
 * account consented. Telegram echoes the value we gave `setWebhook`.
 */
const hasValidSecret = (header: string | null) =>
	equalsInConstantTime(
		Buffer.from(header ?? ""),
		Buffer.from(env.TELEGRAM_WEBHOOK_SECRET),
	);

/**
 * Always 200 once the secret checks out. Telegram retries anything else, and a
 * payload we cannot use will not become usable on the second attempt.
 */
const acknowledged = () => new Response(null, { status: 200 });

const forbidden = () => new Response("Forbidden", { status: 403 });

const handleMessage = async (
	updateId: number,
	{ date, chat, text }: NonNullable<Update["message"]>,
) => {
	if (!text) return;

	const container = getContainer();
	const chatId = String(chat.id);

	if (text.trim().toLowerCase() === OPT_OUT_COMMAND) {
		await container.telegramPairingService.optOut({ chatId });
		getLoggerStore().info("A Telegram recipient sent /stop");
		return;
	}

	const code = extractPairingCode(text);
	// Anyone can write to the bot without ever having asked for a link, and every
	// new chat opens with a bare `/start`. That is a conversation, not a failure.
	if (!code) return;

	const result = await container.telegramPairingService.confirmPairing({
		code,
		chatId,
		updateId: String(updateId),
		// Telegram dates the message in seconds; the column is a timestamptz.
		receivedAt: new Date(date * 1000),
	});

	if (result.outcome !== "paired") {
		getLoggerStore().info(
			{ outcome: result.outcome },
			"A Telegram /start carried a code we could not use",
		);
		return;
	}

	const locale = isLocale(result.locale) ? result.locale : DEFAULT_LOCALE;

	// This never throws — the pairing is already recorded, and losing the
	// acknowledgement is not worth making Telegram retry the webhook.
	await container.telegramPairingService.sendMessage({
		chatId,
		text: DICTIONARIES[locale].auth.profile.telegram.acknowledgement,
	});
};

const handleChatMember = async ({
	chat,
	new_chat_member,
}: NonNullable<Update["my_chat_member"]>) => {
	if (!UNREACHABLE_STATUSES.has(new_chat_member.status)) return;

	// Losing the chat is an opt-out that never sends a word: Telegram refuses every
	// later `sendMessage`, so treating it as anything else would leave a row
	// claiming a consent we can no longer act on.
	await getContainer().telegramPairingService.optOut({
		chatId: String(chat.id),
	});
	getLoggerStore().info("A Telegram chat became unreachable, opting it out");
};

/**
 * The endpoint Telegram calls. It is not an accessory of the pairing, it *is* the
 * pairing: the `/start` is what carries a chat id we could not have forged, and
 * the consent it completes was recorded on our page when the code was minted.
 */
export const Route = createFileRoute("/api/telegram/webhook")({
	server: {
		handlers: {
			POST: ({ request }) =>
				withRequestLogger(
					{ route: new URL(request.url).pathname },
					async () => {
						if (!hasValidSecret(request.headers.get(SECRET_HEADER))) {
							getLoggerStore().warn(
								"Rejected a Telegram webhook carrying an invalid secret token",
							);
							return forbidden();
						}

						let update: Update;

						try {
							update = updateSchema.parse(await request.json());
						} catch (error) {
							getLoggerStore().warn(
								{ err: error },
								"Unreadable Telegram webhook payload",
							);
							return acknowledged();
						}

						if (update.message) {
							await handleMessage(update.update_id, update.message);
						}

						if (update.my_chat_member) {
							await handleChatMember(update.my_chat_member);
						}

						return acknowledged();
					},
				),
		},
	},
});
