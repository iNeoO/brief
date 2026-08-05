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

/** Hard limit of the speech API: a single call is rejected outright past this. */
export const MAX_TTS_INPUT_CHARS = 4096;

/**
 * Packing threshold used to group a brief's paragraphs into TTS chunks. Kept
 * under MAX_TTS_INPUT_CHARS so a chunk never risks brushing the API's hard
 * limit.
 */
export const TTS_CHUNK_SAFE_CHARS = 4000;

/**
 * Ceiling on the whole brief before it is even split into chunks. Guards
 * against the LLM ignoring its word-count guidance and returning something
 * an order of magnitude too long, which would otherwise silently turn into a
 * long chain of TTS calls instead of failing loudly.
 */
export const MAX_TTS_TOTAL_CHARS = 4 * TTS_CHUNK_SAFE_CHARS;
