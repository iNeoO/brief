import { LANGUAGE } from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import { DELIVERY_INSTRUCTIONS, DELIVERY_SPEED } from "./tts.prompt.js";

const LANGUAGES = Object.values(LANGUAGE);

describe("the delivery prompts", () => {
	it("steers the voice in every language the app can brief in", () => {
		// A missing entry would send `undefined` as the instructions and the
		// speech API answers 400, so the brief would never get a voice.
		for (const language of LANGUAGES) {
			expect(DELIVERY_INSTRUCTIONS[language].length).toBeGreaterThan(0);
			expect(DELIVERY_SPEED[language]).toBeGreaterThan(0);
		}

		expect(Object.keys(DELIVERY_INSTRUCTIONS)).toEqual(
			expect.arrayContaining([...LANGUAGES]),
		);
		expect(Object.keys(DELIVERY_SPEED)).toEqual(
			expect.arrayContaining([...LANGUAGES]),
		);
	});

	it("keeps every rate inside the range the speech API accepts", () => {
		// `TTS_SPEED` is validated 0.25..4 by the env schema; a default outside
		// that range would only fail once a brief is being voiced.
		for (const language of LANGUAGES) {
			expect(DELIVERY_SPEED[language]).toBeGreaterThanOrEqual(0.25);
			expect(DELIVERY_SPEED[language]).toBeLessThanOrEqual(4);
		}
	});

	it("reads French faster than English", () => {
		// French carries more syllables for the same news, so it has to be read
		// faster to fit a newsreader's minute.
		expect(DELIVERY_SPEED[LANGUAGE.FR]).toBeGreaterThan(
			DELIVERY_SPEED[LANGUAGE.EN],
		);
	});
});
