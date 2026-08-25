import { TTS_CHUNK_SAFE_CHARS } from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import { splitTextForTts } from "./tts.chunk.js";

/** A paragraph of exactly `length` characters, with no sentence boundary. */
const block = (length: number) => "a".repeat(length);

/** A sentence of exactly `length` characters, ending on a full stop. */
const sentence = (length: number) => `${"b".repeat(length - 1)}.`;

describe("splitTextForTts", () => {
	it("hands back a text that already fits in one call", () => {
		const text = "Voici le brief.\n\nPremière histoire.";

		expect(splitTextForTts(text)).toEqual([text]);
	});

	it("keeps a text of exactly the chunk size whole, spacing and all", () => {
		// One character more and it would be cut into paragraphs and re-spaced.
		const text = `${block(2_000)}\n\n\n${block(TTS_CHUNK_SAFE_CHARS - 2_003)}`;

		expect(text).toHaveLength(TTS_CHUNK_SAFE_CHARS);
		expect(splitTextForTts(text)).toEqual([text]);
	});

	it("packs whole paragraphs together up to the chunk size", () => {
		const [first, second, third] = [block(1900), block(1900), block(1900)];

		const chunks = splitTextForTts([first, second, third].join("\n\n"));

		// The first two fit together (1900 + 2 + 1900); the third opens a chunk.
		expect(chunks).toEqual([`${first}\n\n${second}`, third]);
		expect(chunks.every((chunk) => chunk.length <= TTS_CHUNK_SAFE_CHARS)).toBe(
			true,
		);
	});

	it("drops the blank paragraphs and the padding around them", () => {
		const [first, second] = [block(2500), block(2500)];

		expect(splitTextForTts(`  ${first}  \n\n\n \n\n  ${second}\n`)).toEqual([
			first,
			second,
		]);
	});

	it("cuts a paragraph too long for one call on its sentence boundaries", () => {
		const sentences = Array.from({ length: 6 }, () => sentence(1000));

		const chunks = splitTextForTts(sentences.join(" "));

		// Three sentences a chunk: a fourth would take it to 4003 characters.
		expect(chunks).toEqual([
			sentences.slice(0, 3).join(" "),
			sentences.slice(3).join(" "),
		]);
	});

	it("starts a fresh chunk on the oversized paragraph rather than mixing it in", () => {
		const short = block(500);
		const long = [sentence(2500), sentence(2500)].join(" ");

		const chunks = splitTextForTts(`${short}\n\n${long}\n\n${short}`);

		expect(chunks).toEqual([short, sentence(2500), sentence(2500), short]);
	});

	it("loses no word along the way", () => {
		const text = Array.from({ length: 5 }, (_, index) =>
			`histoire ${index} ${"mot ".repeat(400)}`.trim(),
		).join("\n\n");

		expect(splitTextForTts(text).join("\n\n")).toBe(text);
	});

	it("hands back a single unsplittable sentence over the limit", () => {
		// Nothing to cut on: the speech API will reject it, and it is better to
		// surface that than to slice a word in half.
		const text = block(TTS_CHUNK_SAFE_CHARS + 1000);

		expect(splitTextForTts(text)).toEqual([text]);
	});

	it("never returns nothing, even for an empty brief", () => {
		expect(splitTextForTts("")).toEqual([""]);
	});
});
