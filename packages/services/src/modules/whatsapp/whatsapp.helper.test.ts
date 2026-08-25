import {
	WHATSAPP_PAIRING_CODE_ALPHABET,
	WHATSAPP_PAIRING_CODE_LENGTH,
} from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import { extractPairingCode, generatePairingCode } from "./whatsapp.helper.js";

const CODE = "K7M2QX9RTB";

describe("generatePairingCode", () => {
	it("draws only from the unambiguous alphabet, at the configured length", () => {
		for (let i = 0; i < 200; i++) {
			const code = generatePairingCode();

			expect(code).toHaveLength(WHATSAPP_PAIRING_CODE_LENGTH);
			for (const char of code) {
				expect(WHATSAPP_PAIRING_CODE_ALPHABET).toContain(char);
			}
		}
	});

	// The digit is what separates a code from a word in the sentence around it,
	// so it is a guarantee rather than a likelihood.
	it("always contains at least one digit", () => {
		for (let i = 0; i < 200; i++) {
			expect(generatePairingCode()).toMatch(/\d/);
		}
	});

	it("round-trips through extraction", () => {
		for (let i = 0; i < 200; i++) {
			const code = generatePairingCode();
			expect(extractPairingCode(`I authorise Brief. Code: ${code}`)).toBe(code);
		}
	});
});

describe("extractPairingCode", () => {
	it("reads the code out of the sentence we prefilled", () => {
		expect(
			extractPairingCode(
				`J'autorise Brief à m'envoyer mes briefs quotidiens sur WhatsApp. Code : ${CODE}`,
			),
		).toBe(CODE);
	});

	// The wa.me prefill is editable: the wording that comes back is not ours.
	it("reads the code out of a sentence the user rewrote", () => {
		expect(extractPairingCode(`ok pour whatsapp ${CODE} merci`)).toBe(CODE);
	});

	it("accepts a retyped code in lower case and returns it upper case", () => {
		expect(extractPairingCode(`code ${CODE.toLowerCase()}`)).toBe(CODE);
	});

	it("accepts a code hugged by punctuation", () => {
		expect(extractPairingCode(`Code : "${CODE}".`)).toBe(CODE);
	});

	it("returns nothing when the user wrote to us without a code", () => {
		expect(extractPairingCode("bonjour, c'est quoi Brief ?")).toBeUndefined();
	});

	// STRENGTHEN is ten characters and every one of them is in the alphabet.
	// Without the digit rule it would pair whoever wrote it.
	it("does not mistake a ten-letter word for a code", () => {
		expect(extractPairingCode("STRENGTHEN")).toBeUndefined();
	});

	it("ignores a code glued inside a longer token", () => {
		expect(extractPairingCode(`code${CODE}xyz`)).toBeUndefined();
	});

	it("takes the first code when two were sent", () => {
		expect(extractPairingCode(`${CODE} then P4RSTUVWXY`)).toBe(CODE);
	});
});
