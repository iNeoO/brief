import { MAX_TTS_INPUT_CHARS, MIME_TYPE } from "@brief/common/constants";
import type { Language } from "@brief/common/types";
import { env } from "@brief/infra/configs";
import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";
import OpenAI from "openai";
import { DELIVERY_INSTRUCTIONS } from "./tts.prompt.js";

const RESPONSE_FORMAT = "mp3";

export const TextToSpeechHelper = {
	/**
	 * Voices the brief. The response body is streamed straight through to
	 * storage, so a long brief never lands in the worker's memory whole.
	 */
	textToAudio: async (text: string, language: Language) => {
		if (text.length > MAX_TTS_INPUT_CHARS) {
			throw new InternalError({
				code: "TTS_INPUT_TOO_LONG",
				message: `Brief is ${text.length} characters, over the ${MAX_TTS_INPUT_CHARS} the speech API accepts`,
			});
		}

		const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

		const response = await client.audio.speech.create({
			model: env.TTS_MODEL,
			voice: env.TTS_VOICE,
			input: text,
			response_format: RESPONSE_FORMAT,
			speed: env.TTS_SPEED,
			// Only gpt-4o-mini-tts reads these; the older models reject them.
			...(env.TTS_MODEL === "gpt-4o-mini-tts" && {
				instructions: env.TTS_INSTRUCTIONS ?? DELIVERY_INSTRUCTIONS[language],
			}),
		});

		if (!response.body) {
			getLoggerStore().error(
				{ model: env.TTS_MODEL, voice: env.TTS_VOICE },
				"Text-to-speech returned no audio body",
			);
			throw new InternalError({
				code: "TTS_NO_AUDIO",
				message: "Text-to-speech returned no audio body",
			});
		}

		return { body: response.body, mimeType: MIME_TYPE.MP3 };
	},
};
