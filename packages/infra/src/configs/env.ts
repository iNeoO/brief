import { z } from "zod";

const envSchema = z.object({
	PG_DB: z.string(),
	PG_USER: z.string(),
	PG_PASSWORD: z.string(),
	PG_URL: z.string(),
	FRONTEND_URL: z.url(),
	OPENAI_API_KEY: z.string(),
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
	TTS_SPEED: z.coerce.number().min(0.25).max(4).default(1.1),
});

export const env = envSchema.parse(process.env);
