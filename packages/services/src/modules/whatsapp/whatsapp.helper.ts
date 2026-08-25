import { randomInt } from "node:crypto";
import {
	WHATSAPP_PAIRING_CODE_ALPHABET,
	WHATSAPP_PAIRING_CODE_LENGTH,
} from "@brief/common/constants";

const DIGITS = "23456789";

const hasDigit = /\d/;

/**
 * Built from the alphabet constant rather than written out, so the two can never
 * drift. Word boundaries on both sides: a code glued inside a longer token is not
 * a code, and refusing it is safer than guessing where it starts.
 */
const codePattern = () =>
	new RegExp(
		`\\b[${WHATSAPP_PAIRING_CODE_ALPHABET}]{${WHATSAPP_PAIRING_CODE_LENGTH}}\\b`,
		"gi",
	);

/**
 * Every code carries at least one digit, and `extractPairingCode` requires one.
 * That is what tells a code apart from an ordinary word: the message coming back
 * is a sentence, and no word in a sentence contains a digit, so a ten-letter word
 * can never be read as a code.
 */
export const generatePairingCode = () => {
	const chars = Array.from({ length: WHATSAPP_PAIRING_CODE_LENGTH }, () =>
		WHATSAPP_PAIRING_CODE_ALPHABET.charAt(
			randomInt(WHATSAPP_PAIRING_CODE_ALPHABET.length),
		),
	);

	chars[randomInt(chars.length)] = DIGITS.charAt(randomInt(DIGITS.length));

	return chars.join("");
};

/**
 * The `wa.me` prefill is editable, so the message that comes back is not
 * necessarily the sentence we composed. Only the code is looked for, never the
 * wording — and the first candidate wins if the user somehow sent two.
 */
export const extractPairingCode = (text: string): string | undefined => {
	for (const match of text.matchAll(codePattern())) {
		const candidate = match[0].toUpperCase();
		if (hasDigit.test(candidate)) {
			return candidate;
		}
	}

	return undefined;
};
