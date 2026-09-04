import { LANGUAGE } from "./language.constant.js";

/**
 * The one sentence that has to travel with a brief wherever the brief goes.
 *
 * The page states it in its own words from the web dictionaries; this is the copy
 * for the two carriers those dictionaries cannot reach — the Telegram caption,
 * composed by a worker, and the ID3 comment written into the audio itself, which
 * is the only thing a reader still has once the file has left the site.
 *
 * Keyed by the brief's language, not the reader's: it rides on the content.
 */
export const AI_DISCLOSURE = {
	[LANGUAGE.FR]:
		"Généré par IA : ce brief est écrit et mis en voix par des modèles, sans relecture humaine.",
	[LANGUAGE.EN]:
		"AI-generated: this brief is written and voiced by models, with no human review.",
} as const;
