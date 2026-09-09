import { randomInt } from "node:crypto";
import {
	TELEGRAM_PAIRING_CODE_ALPHABET,
	TELEGRAM_PAIRING_CODE_LENGTH,
} from "@brief/common/constants";

/**
 * `/start` carries the code as its single argument, so the whole message is the
 * command and nothing else has to be told apart from prose. Telegram appends
 * `@botname` when the command is typed in a group.
 */
const START_COMMAND = /^\/start(?:@[A-Za-z0-9_]{5,32})?$/;

export const generatePairingCode = () =>
	Array.from({ length: TELEGRAM_PAIRING_CODE_LENGTH }, () =>
		TELEGRAM_PAIRING_CODE_ALPHABET.charAt(
			randomInt(TELEGRAM_PAIRING_CODE_ALPHABET.length),
		),
	).join("");

/**
 * The code arrives as a structured argument, not buried in a sentence, so this is
 * a parse rather than a search: exactly `/start` and exactly one payload, or no
 * code at all. Anything else is somebody talking to the bot, which is a
 * conversation and not a failed pairing.
 *
 * Case is normalised upward because the manual fallback is retyped by hand and
 * the alphabet is upper case.
 */
export const extractPairingCode = (text: string): string | undefined => {
	const [command, payload, ...rest] = text.trim().split(/\s+/);

	if (rest.length > 0 || !payload || !command) return undefined;
	if (!START_COMMAND.test(command)) return undefined;

	const candidate = payload.toUpperCase();
	const pattern = new RegExp(
		`^[${TELEGRAM_PAIRING_CODE_ALPHABET}]{${TELEGRAM_PAIRING_CODE_LENGTH}}$`,
	);

	return pattern.test(candidate) ? candidate : undefined;
};
