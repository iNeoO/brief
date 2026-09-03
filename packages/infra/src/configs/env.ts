import { z } from "zod";

/**
 * Parsed at import time, so it must hold only what every importer genuinely
 * needs — today that is the text-to-speech block and nothing else. Anything an
 * app owns alone belongs in its own `config/env.ts`: a variable added here is a
 * variable each of the four workers has to set before it will boot.
 */
const envSchema = z.object({
	OPENAI_API_KEY: z.string().min(1),
	// Voicing the brief. Both models read French; the mini one is the cheaper of
	// the two and steerable through its own instructions.
	TTS_MODEL: z
		.enum(["gpt-4o-mini-tts", "tts-1", "tts-1-hd"])
		.default("gpt-4o-mini-tts"),
	TTS_VOICE: z
		.enum([
			"alloy",
			"ash",
			"ballad",
			"coral",
			"echo",
			"fable",
			"onyx",
			"nova",
			"sage",
			"shimmer",
			"verse",
		])
		.default("onyx"),
	// The voices are English natives: without steering they read French with an
	// accent, at a narrator's pace rather than a newsreader's. Left empty, the
	// helper picks the wording that matches the brief's own language.
	TTS_INSTRUCTIONS: z.string().optional(),
	// A newsreader's pace on top of the steering above: the instructions set the
	// tone, this sets the rate. Left empty, the helper picks the rate that suits
	// the brief's own language — set here, it overrides every language at once.
	TTS_SPEED: z.coerce.number().min(0.25).max(4).optional(),
});

export const env = envSchema.parse(process.env);
