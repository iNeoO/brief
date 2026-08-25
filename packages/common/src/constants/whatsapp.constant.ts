/**
 * A user who has authorised us is `verified`; one who has since replied STOP is
 * `opted_out`. There is deliberately no `pending`: a user with no pairing row has
 * not paired. The waiting state lives in Redis, as the code we are waiting for.
 */
export const WHATSAPP_PAIRING_STATUS = {
	VERIFIED: "verified",
	OPTED_OUT: "opted_out",
} as const;

export const WHATSAPP_PAIRING_CODE_LENGTH = 10;

/**
 * No lookalike pairs. The code is prefilled into a WhatsApp message the user can
 * edit before sending, so it may well be retyped by hand: O and 0, I and 1 and L
 * never share an alphabet.
 */
export const WHATSAPP_PAIRING_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Long enough to survive "I will do it in a minute", short enough that an
 * abandoned code is not still live an hour later.
 */
export const WHATSAPP_PAIRING_CODE_TTL_SECONDS = 15 * 60;

export const WHATSAPP_PAIRING_CODE_REDIS_PREFIX = "brief:whatsapp:pairing:";
