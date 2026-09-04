import { AI_DISCLOSURE, BRAND_NAME, LANGUAGE } from "@brief/common/constants";
import type { Language } from "@brief/common/types";
import { describe, expect, it } from "vitest";
import { buildId3Tag } from "./tts.tags.js";

const TARGET_DATE = new Date("2026-08-28T00:00:00.000Z");

const tag = (language: Language = LANGUAGE.FR) =>
	buildId3Tag({
		title: "Économie — 28 août 2026",
		language,
		targetDate: TARGET_DATE,
	});

/** UTF-16LE, minus the BOM in front and whatever nulls trail it. */
const decode = (buffer: Buffer) =>
	buffer.subarray(2).toString("utf16le").replace(/\0+$/, "");

/**
 * Walks the tag the way a player does: read the size out of the header, then take
 * frames one after another until it is spent. Deliberately not the writer's own
 * arithmetic run backwards — a test that shares the bug it is looking for finds
 * nothing.
 */
const readFrames = (buffer: Buffer) => {
	const size =
		(buffer.readUInt8(6) << 21) |
		(buffer.readUInt8(7) << 14) |
		(buffer.readUInt8(8) << 7) |
		buffer.readUInt8(9);
	const frames: Record<string, Buffer> = {};

	let cursor = 10;

	while (cursor < 10 + size) {
		const id = buffer.subarray(cursor, cursor + 4).toString("latin1");
		const length = buffer.readUInt32BE(cursor + 4);

		frames[id] = buffer.subarray(cursor + 10, cursor + 10 + length);
		cursor += 10 + length;
	}

	return { frames, size, end: cursor };
};

describe("buildId3Tag", () => {
	it("opens with an ID3v2.3 header whose size covers exactly the frames", () => {
		const buffer = tag();
		const { size, end } = readFrames(buffer);

		expect(buffer.subarray(0, 3).toString()).toBe("ID3");
		expect([buffer.readUInt8(3), buffer.readUInt8(4)]).toEqual([3, 0]);
		// Nothing left over and nothing missing: the last frame ends where the tag
		// says it does, which is what stops a decoder reading into the audio.
		expect(end).toBe(10 + size);
		expect(buffer.length).toBe(10 + size);
	});

	it("names the file so a player has something to show", () => {
		const { frames } = readFrames(tag());

		expect(decode(frames.TIT2?.subarray(1) ?? Buffer.alloc(0))).toBe(
			"Économie — 28 août 2026",
		);
		expect(decode(frames.TPE1?.subarray(1) ?? Buffer.alloc(0))).toBe(
			BRAND_NAME,
		);
		expect(decode(frames.TALB?.subarray(1) ?? Buffer.alloc(0))).toBe(
			BRAND_NAME,
		);
	});

	// A brief dated at UTC midnight is the previous year's, west of Greenwich, on
	// exactly one day a year. Reading it in UTC is what the rest of the app does.
	it("dates the brief on its own calendar day", () => {
		const { frames } = readFrames(
			buildId3Tag({
				title: "New Year",
				language: LANGUAGE.EN,
				targetDate: new Date("2027-01-01T00:00:00.000Z"),
			}),
		);

		expect(decode(frames.TYER?.subarray(1) ?? Buffer.alloc(0))).toBe("2027");
	});

	it("writes the disclosure into the file, in the brief's language", () => {
		for (const language of [LANGUAGE.FR, LANGUAGE.EN]) {
			const comment = readFrames(tag(language)).frames.COMM ?? Buffer.alloc(0);

			// Encoding byte, three-letter language, then an empty description before
			// the comment itself.
			expect(comment.subarray(1, 4).toString("latin1")).toBe(
				language === LANGUAGE.FR ? "fra" : "eng",
			);
			expect(decode(comment.subarray(8))).toBe(AI_DISCLOSURE[language]);
		}
	});
});
