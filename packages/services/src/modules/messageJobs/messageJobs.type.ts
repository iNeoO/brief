import type { Locale } from "@brief/common/types";

/**
 * Everything one delivery needs, read in the single statement that claims it.
 * The pairing is read *now* rather than trusted from fan-out time: a reader can
 * block the bot, or withdraw the authorisation entirely, between the moment
 * their brief was scheduled and the moment it is sent — and a delayed retry
 * makes that gap minutes wide.
 *
 * `pairing` is null when the row is gone: a withdrawal deletes it outright, and
 * that has to read as "do not send" rather than as a missing join.
 */
export type ClaimedMessageJob = {
	id: number;
	categoryJobId: number;
	userId: string;
	retry: number;
	isFirst: boolean | null;
	pairing: {
		chatId: string;
		locale: Locale;
		status: "verified" | "opted_out";
	} | null;
	categoryName: string;
	targetDate: Date;
	audioFileId: string | null;
};

/**
 * What the delivery decided, for the consumer to turn into an AMQP acknowledgement.
 * The verdict stays free of AMQP so `packages/services` does not learn about queues.
 */
export type DeliveryVerdict =
	| { outcome: "sent" }
	| { outcome: "retry"; delayMs: number }
	| { outcome: "failed"; reason: string }
	| { outcome: "opted-out" }
	| { outcome: "skipped"; reason: string };

export type MessageDeliveryConfig = {
	/** Public origin Telegram fetches the brief audio from. No trailing slash. */
	siteUrl: string;
};
