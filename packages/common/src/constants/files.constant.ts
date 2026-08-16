export const FILE_KIND = {
	AUDIO_FILE: "audio_file",
} as const;

export const MIME_TYPE = {
	MP3: "audio/mpeg",
} as const;

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const MAX_TTS_INPUT_CHARS = 4096;

export const TTS_CHUNK_SAFE_CHARS = 4000;

export const MAX_TTS_TOTAL_CHARS = 4 * TTS_CHUNK_SAFE_CHARS;
