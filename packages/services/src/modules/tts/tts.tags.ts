import { AI_DISCLOSURE, BRAND_NAME } from "@brief/common/constants";
import type { Language } from "@brief/common/types";

/**
 * The speech API returns bare MPEG frames — no ID3, no metadata of any kind — so
 * a brief saved out of Telegram or downloaded from the page shows up in a player
 * as an unknown artist with a file name for a title. This writes the tag the file
 * should have arrived with.
 *
 * ID3v2.3 rather than v2.4: it is the version every player reads, and the only
 * thing v2.4 would buy here is UTF-8 in place of UTF-16.
 *
 * Written by hand rather than pulled from a package: the format is a header, a
 * size and a list of frames, we write five of them, and a dependency that ships
 * a parser we will never call is a poor trade.
 */

/** ISO-8859-1 cannot hold every category name; UTF-16 with a BOM can. */
const ENCODING_UTF16 = 0x01;
/** Little-endian, which is the order `Buffer.from(value, "utf16le")` writes in. */
const BOM = Buffer.from([0xff, 0xfe]);
const TERMINATOR = Buffer.from([0x00, 0x00]);

/** ISO-639-2, which is what a `COMM` frame names its language in. */
const ISO_639_2: Record<Language, string> = { fr: "fra", en: "eng" };

const encode = (value: string) =>
	Buffer.concat([BOM, Buffer.from(value, "utf16le")]);

/**
 * A frame header is its four-letter id, the size of what follows, and two flag
 * bytes. The size is a plain big-endian integer here — only the *tag* header uses
 * the synchsafe form.
 */
const frame = (id: string, body: Buffer) => {
	const header = Buffer.alloc(10);

	header.write(id, 0, "latin1");
	header.writeUInt32BE(body.length, 4);

	return Buffer.concat([header, body]);
};

const textFrame = (id: string, value: string) =>
	frame(
		id,
		Buffer.concat([Buffer.from([ENCODING_UTF16]), encode(value), TERMINATOR]),
	);

/**
 * `COMM` carries two strings, not one: a short description nobody displays, then
 * the comment itself. The description is empty and terminated, which is what
 * tells a reader where the comment starts.
 */
const commentFrame = (language: Language, value: string) =>
	frame(
		"COMM",
		Buffer.concat([
			Buffer.from([ENCODING_UTF16]),
			Buffer.from(ISO_639_2[language], "latin1"),
			BOM,
			TERMINATOR,
			encode(value),
		]),
	);

/**
 * The tag's own size is stored across four bytes that only use seven bits each,
 * so that a size can never be mistaken for the frame sync a decoder scans for.
 */
const synchsafe = (size: number) =>
	Buffer.from([
		(size >>> 21) & 0x7f,
		(size >>> 14) & 0x7f,
		(size >>> 7) & 0x7f,
		size & 0x7f,
	]);

export type AudioTags = {
	title: string;
	language: Language;
	targetDate: Date;
};

export const buildId3Tag = ({ title, language, targetDate }: AudioTags) => {
	const frames = Buffer.concat([
		textFrame("TIT2", title),
		textFrame("TPE1", BRAND_NAME),
		textFrame("TALB", BRAND_NAME),
		// The calendar day is read in UTC, as it is everywhere else a target date
		// is shown: any other zone dates a brief the day before west of Greenwich.
		textFrame("TYER", String(new Date(targetDate).getUTCFullYear())),
		// The disclosure belongs in the file, not only around it. A brief that has
		// been forwarded twice is exactly the case Article 50(4) is about.
		commentFrame(language, AI_DISCLOSURE[language]),
	]);

	return Buffer.concat([
		Buffer.from("ID3", "latin1"),
		Buffer.from([0x03, 0x00, 0x00]),
		synchsafe(frames.length),
		frames,
	]);
};
