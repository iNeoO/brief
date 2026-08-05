import { TTS_CHUNK_SAFE_CHARS } from "@brief/common/constants";

const PARAGRAPH_SEPARATOR = /\n\s*\n/;
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;

function splitParagraphBySentence(paragraph: string): string[] {
	const sentences = paragraph.split(SENTENCE_BOUNDARY);
	const chunks: string[] = [];
	let current = "";

	for (const sentence of sentences) {
		const candidate = current ? `${current} ${sentence}` : sentence;
		if (current && candidate.length > TTS_CHUNK_SAFE_CHARS) {
			chunks.push(current);
			current = sentence;
		} else {
			current = candidate;
		}
	}
	if (current) chunks.push(current);

	return chunks.length > 0 ? chunks : [paragraph];
}

export function splitTextForTts(text: string): string[] {
	if (text.length <= TTS_CHUNK_SAFE_CHARS) return [text];

	const paragraphs = text
		.split(PARAGRAPH_SEPARATOR)
		.map((paragraph) => paragraph.trim())
		.filter((paragraph) => paragraph.length > 0);

	const chunks: string[] = [];
	let current: string[] = [];
	let currentLength = 0;

	const flush = () => {
		if (current.length > 0) chunks.push(current.join("\n\n"));
		current = [];
		currentLength = 0;
	};

	for (const paragraph of paragraphs) {
		if (paragraph.length > TTS_CHUNK_SAFE_CHARS) {
			flush();
			chunks.push(...splitParagraphBySentence(paragraph));
			continue;
		}

		const addedLength =
			current.length === 0
				? paragraph.length
				: currentLength + 2 + paragraph.length;

		if (addedLength > TTS_CHUNK_SAFE_CHARS && current.length > 0) {
			flush();
			current = [paragraph];
			currentLength = paragraph.length;
		} else {
			current.push(paragraph);
			currentLength = addedLength;
		}
	}
	flush();

	return chunks.length > 0 ? chunks : [text];
}
