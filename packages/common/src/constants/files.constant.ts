export const FILE_KIND = {
	AUDIO_FILE: "audio_file",
} as const;

export const MIME_TYPE = {
	MP3: "audio/mpeg",
} as const;

/**
 * Upload bodies are streams of unknown length: their size only shows up as
 * they are consumed, and this is how far they are allowed to go.
 */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Hard limit of the speech API: a longer brief is rejected outright. */
export const MAX_TTS_INPUT_CHARS = 4096;
