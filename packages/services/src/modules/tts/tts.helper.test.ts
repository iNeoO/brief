import type { Readable } from "node:stream";
import {
	LANGUAGE,
	MAX_TTS_TOTAL_CHARS,
	MIME_TYPE,
	TTS_CHUNK_SAFE_CHARS,
} from "@brief/common/constants";
import type { Language } from "@brief/common/types";
import { type PinoLogger, wrapWithLogger } from "@brief/infra/libs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELIVERY_INSTRUCTIONS, DELIVERY_SPEED } from "./tts.prompt.js";

/**
 * The env is parsed at import time from `process.env`, so it is replaced by a
 * plain object the tests can retune. Hoisted, because the module under test
 * reads it through a static import.
 */
const { env } = vi.hoisted(() => ({
	env: {
		OPENAI_API_KEY: "sk-test",
		TTS_MODEL: "gpt-4o-mini-tts",
		TTS_VOICE: "onyx",
		TTS_INSTRUCTIONS: undefined as string | undefined,
		TTS_SPEED: undefined as number | undefined,
	},
}));

vi.mock("@brief/infra/configs", () => ({ env }));

const create = vi.fn();
const clients: unknown[] = [];

vi.mock("openai", () => ({
	default: class {
		audio = {
			speech: {
				create: (...args: unknown[]) => create(...args),
			},
		};
		constructor(options: unknown) {
			clients.push(options);
		}
	},
}));

const { TextToSpeechHelper } = await import("./tts.helper.js");

/** What the SDK hands back: a streamed response whose bytes arrive later. */
const audioResponse = (bytes: string) => ({
	body: {},
	arrayBuffer: () => Promise.resolve(Buffer.from(bytes)),
});

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const speak = (text: string, language: Language = LANGUAGE.FR) =>
	wrapWithLogger(logger as unknown as PinoLogger, () =>
		TextToSpeechHelper.textToAudio(text, language),
	);

const collect = async (body: Readable) => {
	const chunks: Buffer[] = [];
	for await (const chunk of body) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString();
};

/** The only request the helper made. */
const request = () => create.mock.calls[0]?.[0];

beforeEach(() => {
	vi.clearAllMocks();
	clients.length = 0;
	env.TTS_MODEL = "gpt-4o-mini-tts";
	env.TTS_VOICE = "onyx";
	env.TTS_INSTRUCTIONS = undefined;
	env.TTS_SPEED = undefined;
	create.mockResolvedValue(audioResponse("audio"));
});

afterEach(() => {
	vi.useRealTimers();
});

describe("textToAudio", () => {
	it("voices the brief and reports what it produced", async () => {
		const { body, mimeType } = await speak("Voici votre brief.");

		expect(mimeType).toBe(MIME_TYPE.MP3);
		await expect(collect(body)).resolves.toBe("audio");
		expect(create).toHaveBeenCalledOnce();
		expect(request()).toMatchObject({
			model: "gpt-4o-mini-tts",
			voice: "onyx",
			input: "Voici votre brief.",
			response_format: "mp3",
		});
	});

	it("opens the client with the configured key", async () => {
		await speak("Voici votre brief.");

		expect(clients).toEqual([{ apiKey: "sk-test" }]);
	});

	it("reads each language at its own rate", async () => {
		await speak("Voici votre brief.", LANGUAGE.FR);
		expect(request().speed).toBe(DELIVERY_SPEED[LANGUAGE.FR]);

		create.mockClear();
		await speak("Here is your brief.", LANGUAGE.EN);
		expect(request().speed).toBe(DELIVERY_SPEED[LANGUAGE.EN]);
	});

	it("lets the environment override the rate and the steering", async () => {
		env.TTS_SPEED = 0.9;
		env.TTS_INSTRUCTIONS = "Parle lentement.";

		await speak("Voici votre brief.");

		expect(request()).toMatchObject({
			speed: 0.9,
			instructions: "Parle lentement.",
		});
	});

	it("steers the delivery when the model can be steered", async () => {
		await speak("Voici votre brief.");

		expect(request().instructions).toBe(DELIVERY_INSTRUCTIONS[LANGUAGE.FR]);
	});

	it("sends no instructions to a model that rejects them", async () => {
		// The older models answer 400 when the field is present at all, so it has
		// to be absent rather than empty.
		env.TTS_MODEL = "tts-1";

		await speak("Voici votre brief.");

		expect(request()).not.toHaveProperty("instructions");
	});

	it("splits a long brief and concatenates the audio in order", async () => {
		// The chunks are spoken in parallel: the wrong order would produce a brief
		// that reads its second half first.
		const first = "A".repeat(TTS_CHUNK_SAFE_CHARS - 100);
		const second = "B".repeat(TTS_CHUNK_SAFE_CHARS - 100);

		create.mockImplementation(async (params: { input: string }) => {
			// The first chunk answers last, so only the ordering can save the audio.
			if (params.input.startsWith("A")) {
				await Promise.resolve();
				await Promise.resolve();
			}
			return audioResponse(params.input.startsWith("A") ? "1" : "2");
		});

		const { body } = await speak(`${first}\n\n${second}`);

		expect(create).toHaveBeenCalledTimes(2);
		await expect(collect(body)).resolves.toBe("12");
		expect(logger.info).toHaveBeenCalledOnce();
	});

	it("accepts a brief of exactly the length the API allows", async () => {
		await expect(speak("a".repeat(MAX_TTS_TOTAL_CHARS))).resolves.toMatchObject(
			{ mimeType: MIME_TYPE.MP3 },
		);
	});

	it("refuses a brief one character too long, without calling the API", async () => {
		await expect(
			speak("a".repeat(MAX_TTS_TOTAL_CHARS + 1)),
		).rejects.toMatchObject({ code: "TTS_INPUT_TOO_LONG" });

		expect(create).not.toHaveBeenCalled();
	});

	it("reports a response that carried no audio", async () => {
		create.mockResolvedValue({ body: null });

		await expect(speak("Voici votre brief.")).rejects.toMatchObject({
			code: "TTS_NO_AUDIO",
		});
		expect(logger.error).toHaveBeenCalledOnce();
	});

	it("gives up once the deadline passes", async () => {
		// The SDK's own timeout stops at the response headers and the audio
		// arrives after them, so without this the job would stay `running`.
		vi.useFakeTimers();
		create.mockImplementation(
			(_params: unknown, { signal }: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					signal.addEventListener("abort", () =>
						reject(new Error("Request was aborted.")),
					);
				}),
		);

		// The expectation is attached before the clock moves, so the rejection is
		// never momentarily unhandled.
		const speaking = expect(speak("Voici votre brief.")).rejects.toMatchObject({
			code: "TTS_TIMEOUT",
		});
		await vi.advanceTimersByTimeAsync(300_000);

		await speaking;
	});

	it("passes a failure that is not a deadline straight through", async () => {
		create.mockRejectedValue(new Error("429 rate limited"));

		await expect(speak("Voici votre brief.")).rejects.toThrow(
			"429 rate limited",
		);
	});
});
