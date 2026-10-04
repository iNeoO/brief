import { Readable } from "node:stream";
import {
	INTERNAL_ERROR_CODE,
	MAX_TTS_TOTAL_CHARS,
	MIME_TYPE,
} from "@brief/common/constants";
import type { Language } from "@brief/common/types";
import { env } from "@brief/infra/configs";
import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";
import OpenAI from "openai";
import { withDeadline } from "../../helpers/withDeadline.helper.js";
import { splitTextForTts } from "./tts.chunk.js";
import { DELIVERY_INSTRUCTIONS } from "./tts.prompt.js";

const RESPONSE_FORMAT = "mp3";

/**
 * Ceiling for the whole brief, chunks included — they are spoken in parallel, so
 * one figure bounds the step. The SDK's own timeout stops at the response
 * headers, and the audio arrives after them.
 */
const DEADLINE_MS = 300_000;

const speakChunk = async (
	client: OpenAI,
	text: string,
	language: Language,
	signal: AbortSignal,
) => {
	const response = await client.audio.speech.create(
		{
			model: env.TTS_MODEL,
			voice: env.TTS_VOICE,
			input: text,
			response_format: RESPONSE_FORMAT,
			speed: env.TTS_SPEED,
			// Only gpt-4o-mini-tts reads these; the older models reject them.
			...(env.TTS_MODEL === "gpt-4o-mini-tts" && {
				instructions: env.TTS_INSTRUCTIONS ?? DELIVERY_INSTRUCTIONS[language],
			}),
		},
		{ signal },
	);

	if (!response.body) {
		getLoggerStore().error(
			{ model: env.TTS_MODEL, voice: env.TTS_VOICE },
			"Text-to-speech returned no audio body",
		);
		throw new InternalError({
			code: INTERNAL_ERROR_CODE.TTS_NO_AUDIO,
			message: "Text-to-speech returned no audio body",
		});
	}

	return Buffer.from(await response.arrayBuffer());
};

export const TextToSpeechHelper = {
	textToAudio: async (text: string, language: Language) => {
		if (text.length > MAX_TTS_TOTAL_CHARS) {
			throw new InternalError({
				code: INTERNAL_ERROR_CODE.TTS_INPUT_TOO_LONG,
				message: `Brief is ${text.length} characters, over the ${MAX_TTS_TOTAL_CHARS} the speech API accepts`,
			});
		}

		const chunks = splitTextForTts(text);
		const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

		if (chunks.length > 1) {
			getLoggerStore().info(
				{ chunks: chunks.length },
				"Brief split into multiple text-to-speech calls",
			);
		}

		const buffers = await withDeadline({
			context: "Text-to-speech",
			timeoutMs: DEADLINE_MS,
			timeoutCode: INTERNAL_ERROR_CODE.TTS_TIMEOUT,
			run: ({ signal }) =>
				Promise.all(
					chunks.map((chunk) => speakChunk(client, chunk, language, signal)),
				),
		});

		return {
			body: Readable.from(Buffer.concat(buffers)),
			mimeType: MIME_TYPE.MP3,
		};
	},
};
