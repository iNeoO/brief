export type TelegramConfig = {
	/** Bot token from @BotFather. The only credential Telegram needs. */
	botToken: string;
	/** Without the leading `@`. This is what the `t.me` deep link addresses. */
	botUsername: string;
};

export type StartPairingInput = {
	userId: string;
	/**
	 * Carried through the pairing so the acknowledgement can answer in the
	 * language the user was reading when they asked for the link. There is nowhere
	 * else to keep it: the webhook has no session and no request locale.
	 */
	locale: string;
	/**
	 * The consent wording exactly as the page displayed it next to the button.
	 * Tapping Start proves control of the Telegram account, not agreement, so the
	 * evidence has to travel from the page that showed it — see `optInText`.
	 */
	consentText: string;
};

export type PairingCode = { code: string };

export type ConfirmPairingInput = {
	code: string;
	/** Telegram's chat id as text: it is an int64 and JavaScript numbers are not. */
	chatId: string;
	/** Telegram's monotonic `update_id`, the idempotency key for a redelivery. */
	updateId: string;
	receivedAt: Date;
};

/**
 * `already-processed` and `unknown-code` are both non-events for the caller:
 * Telegram redelivers updates, and anyone can message the bot without a code.
 * Neither is an error, which is why this is a result rather than a thrown
 * DomainError.
 */
export type ConfirmPairingResult =
	| { outcome: "paired"; userId: string; locale: string }
	| { outcome: "already-processed" }
	| { outcome: "unknown-code" };

export type PairingSummary = {
	status: "verified" | "opted_out";
	optInAt: Date;
};
