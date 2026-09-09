import {
	TELEGRAM_PAIRING_CODE_ALPHABET,
	TELEGRAM_PAIRING_CODE_LENGTH,
} from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import { extractPairingCode, generatePairingCode } from "./telegram.helper.js";

const CODE = "K7M2QX9RTB";

describe("generatePairingCode", () => {
	it("draws only from the unambiguous alphabet, at the configured length", () => {
		for (let i = 0; i < 200; i++) {
			const code = generatePairingCode();

			expect(code).toHaveLength(TELEGRAM_PAIRING_CODE_LENGTH);
			for (const char of code) {
				expect(TELEGRAM_PAIRING_CODE_ALPHABET).toContain(char);
			}
		}
	});

	// The deep-link payload allows `A-Za-z0-9_-` up to 64 characters, so a code
	// that fits the alphabet is always a legal `?start=` value.
	it("produces a legal deep-link payload", () => {
		for (let i = 0; i < 200; i++) {
			expect(generatePairingCode()).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
		}
	});

	it("round-trips through extraction", () => {
		for (let i = 0; i < 200; i++) {
			const code = generatePairingCode();
			expect(extractPairingCode(`/start ${code}`)).toBe(code);
		}
	});
});

describe("extractPairingCode", () => {
	it("reads the code out of the command Telegram sends when Start is tapped", () => {
		expect(extractPairingCode(`/start ${CODE}`)).toBe(CODE);
	});

	// Telegram appends `@botname` to a command typed in a group chat.
	it("accepts the command addressed to the bot in a group", () => {
		expect(extractPairingCode(`/start@brief_daily_bot ${CODE}`)).toBe(CODE);
	});

	it("tolerates surrounding and repeated whitespace", () => {
		expect(extractPairingCode(`  /start   ${CODE}\n`)).toBe(CODE);
	});

	// The bare `/start` is what every new chat opens with, and what the Telegram
	// client's menu button sends. It is not a pairing attempt.
	it("returns nothing for a bare /start", () => {
		expect(extractPairingCode("/start")).toBeUndefined();
	});

	it("accepts a payload retyped in lower case and returns it upper case", () => {
		expect(extractPairingCode(`/start ${CODE.toLowerCase()}`)).toBe(CODE);
	});

	// A parse, not a search: the code is an argument, so a code sitting in prose
	// was never sent as a command and does not pair anybody.
	it("ignores a code that is not the argument of /start", () => {
		expect(extractPairingCode(`here is my code ${CODE}`)).toBeUndefined();
		expect(extractPairingCode(CODE)).toBeUndefined();
	});

	it("refuses a second argument", () => {
		expect(extractPairingCode(`/start ${CODE} please`)).toBeUndefined();
	});

	it("refuses another command carrying the code", () => {
		expect(extractPairingCode(`/stop ${CODE}`)).toBeUndefined();
		expect(extractPairingCode(`/startpairing ${CODE}`)).toBeUndefined();
	});

	it("refuses a payload of the wrong length or alphabet", () => {
		expect(extractPairingCode("/start K7M2QX9RT")).toBeUndefined();
		expect(extractPairingCode("/start K7M2QX9RTBB")).toBeUndefined();
		// I, O, L and 0/1 are deliberately absent from the alphabet.
		expect(extractPairingCode("/start K7M2QXIRTB")).toBeUndefined();
	});

	it("returns nothing when the user wrote to the bot without a command", () => {
		expect(extractPairingCode("bonjour, c'est quoi Brief ?")).toBeUndefined();
	});
});
