import { LOCALE } from "./locale.constant.js";

/**
 * The captions that ride along with a brief's audio on Telegram.
 *
 * They live here rather than in `apps/web/src/libs/i18n` because the
 * message-worker composes them and cannot import the web dictionaries — the same
 * reason `BRAND_NAME` sits in this package. The pairing acknowledgement stays in
 * the web dictionaries: it is written inside a request that has a locale, and
 * moving it would buy nothing.
 *
 * `announcement` opens the reader's day and is sent once, folded into the caption
 * of whichever topic finishes first. A separate announcement message would need a
 * guarantee that it arrives before that first audio, which two workers cannot
 * give.
 */
export const TELEGRAM_MESSAGE_COPY = {
	[LOCALE.FR]: {
		announcement: (date: string) =>
			`Voici vos sujets pour la journée du ${date}.`,
		topic: (name: string) => `Voici l'audio pour le topic ${name}.`,
	},
	[LOCALE.EN]: {
		announcement: (date: string) => `Here are your topics for ${date}.`,
		topic: (name: string) => `Here is the audio for the topic ${name}.`,
	},
} as const;

/** Telegram rejects a caption over this. Ours are two short lines; this is a guard. */
export const TELEGRAM_CAPTION_MAX_LENGTH = 1024;
