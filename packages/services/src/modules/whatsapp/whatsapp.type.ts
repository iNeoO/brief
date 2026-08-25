export type WhatsAppConfig = {
	/**
	 * Our WhatsApp Business number in E.164 digits with no leading `+`. This is
	 * the number the user writes *to*, so it is what the `wa.me` link carries.
	 */
	senderNumber: string;
	/** Cloud API phone number id, used only to answer inside the 24h window. */
	phoneNumberId: string;
	accessToken: string;
	apiVersion: string;
};

export type StartPairingInput = {
	userId: string;
	/**
	 * Carried through the pairing so the acknowledgement can answer in the
	 * language the user was reading when they asked for the link. There is nowhere
	 * else to keep it: the webhook has no session and no request locale.
	 */
	locale: string;
};

export type PairingCode = { code: string };

export type ConfirmPairingInput = {
	code: string;
	/** E.164 without the `+`, verbatim from the inbound `from` field. */
	phoneNumber: string;
	messageId: string;
	/** What the user actually sent. Stored as the opt-in record. */
	text: string;
	receivedAt: Date;
};

/**
 * `already-processed` and `unknown-code` are both non-events for the caller: Meta
 * redelivers webhooks, and anyone can write to our number without a code. Neither
 * is an error, which is why this is a result rather than a thrown DomainError.
 */
export type ConfirmPairingResult =
	| { outcome: "paired"; userId: string; locale: string }
	| { outcome: "already-processed" }
	| { outcome: "unknown-code" };

export type PairingSummary = {
	phoneNumber: string;
	status: "verified" | "opted_out";
	optInAt: Date;
};
