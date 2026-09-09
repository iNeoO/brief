/**
 * A user who has authorised us is `verified`; one who has since sent `/stop` or
 * blocked the bot is `opted_out`. There is deliberately no `pending`: a user with
 * no pairing row has not paired. The waiting state lives in Redis, as the code we
 * are waiting for.
 */
export const TELEGRAM_PAIRING_STATUS = {
	VERIFIED: "verified",
	OPTED_OUT: "opted_out",
} as const;

export const TELEGRAM_PAIRING_CODE_LENGTH = 10;

/**
 * No lookalike pairs. The code normally travels inside the `t.me` deep link and
 * is never read by a human, but the manual fallback is to type `/start CODE` into
 * Telegram by hand: O and 0, I and 1 and L never share an alphabet.
 *
 * Every character is also legal in a deep-link payload, which allows `A-Za-z0-9_-`
 * up to 64 characters.
 */
export const TELEGRAM_PAIRING_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Long enough to survive "I will do it in a minute", short enough that an
 * abandoned code is not still live an hour later.
 */
export const TELEGRAM_PAIRING_CODE_TTL_SECONDS = 15 * 60;

export const TELEGRAM_PAIRING_CODE_REDIS_PREFIX = "brief:telegram:pairing:";
