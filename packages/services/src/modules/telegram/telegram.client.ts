import { getLoggerStore } from "@brief/infra/libs";
import type {
	SendAudioInput,
	SendMessageInput,
	TelegramConfig,
	TelegramSendResult,
} from "./telegram.type.js";

/** A courtesy reply must never be what holds up a webhook. */
const TEXT_TIMEOUT_MS = 5_000;

/**
 * Longer than a text call because Telegram fetches the audio from our URL itself
 * before answering: the round trip includes a download of several megabytes from
 * our own app.
 */
const AUDIO_TIMEOUT_MS = 30_000;

/** A 429 without a figure still deserves a pause rather than an immediate retry. */
const DEFAULT_RETRY_AFTER_MS = 1_000;

/**
 * What Telegram answers when the chat is closed to us for good. A 403 always
 * means it — blocked, deactivated, or a group we were removed from — and a
 * `chat not found` means the chat id no longer resolves. Neither improves by
 * being retried; both should end the pairing.
 */
const isGoneForGood = (status: number, description: string) =>
	status === 403 ||
	(status === 400 && description.toLowerCase().includes("chat not found"));

type TelegramErrorBody = {
	description?: unknown;
	parameters?: { retry_after?: unknown };
};

const readErrorBody = (raw: string): TelegramErrorBody => {
	try {
		const parsed: unknown = JSON.parse(raw);
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
};

/**
 * The Bot API calls, and nothing else — no database, no Redis. That is what lets
 * the message-worker send without dragging the pairing service's dependencies
 * along.
 *
 * Every call returns a verdict instead of throwing. The caller decides what a
 * failure means: the pairing acknowledgement discards it, a brief delivery
 * retries or ends the pairing on it.
 *
 * The token lives in the URL because that is where Telegram's API puts it, so
 * nothing here may ever log the request — only the status, the description and
 * the error itself.
 */
export class TelegramClient {
	constructor(private config: TelegramConfig) {}

	sendMessage({ chatId, text }: SendMessageInput) {
		return this.call("sendMessage", { chat_id: chatId, text }, TEXT_TIMEOUT_MS);
	}

	/**
	 * The audio travels as a URL rather than an upload: Telegram fetches it from
	 * our public brief endpoint, which keeps object storage out of the worker
	 * entirely. Telegram caps a fetched file at 20 MB — a brief's audio runs to
	 * about 4 MB, so the margin is wide.
	 *
	 * `title` and `performer` are what the native player displays; without them it
	 * shows a bare file name.
	 */
	sendAudio({ chatId, audioUrl, caption, title, performer }: SendAudioInput) {
		return this.call(
			"sendAudio",
			{
				chat_id: chatId,
				audio: audioUrl,
				caption,
				title,
				performer,
			},
			AUDIO_TIMEOUT_MS,
		);
	}

	private async call(
		method: string,
		body: Record<string, unknown>,
		timeoutMs: number,
	): Promise<TelegramSendResult> {
		const logger = getLoggerStore();
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const response = await fetch(
				`https://api.telegram.org/bot${this.config.botToken}/${method}`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body),
					signal: controller.signal,
				},
			);

			if (response.ok) return { ok: true };

			const parsed = readErrorBody(await response.text());
			const description =
				typeof parsed.description === "string" ? parsed.description : "";
			const retryAfter = parsed.parameters?.retry_after;

			logger.warn(
				{ method, status: response.status, description },
				"Telegram refused a call",
			);

			if (response.status === 429) {
				return {
					ok: false,
					retryable: true,
					optOut: false,
					status: response.status,
					description,
					retryAfterMs:
						typeof retryAfter === "number"
							? retryAfter * 1000
							: DEFAULT_RETRY_AFTER_MS,
				};
			}

			return {
				ok: false,
				retryable: response.status >= 500,
				optOut: isGoneForGood(response.status, description),
				status: response.status,
				description,
			};
		} catch (error) {
			// A timeout or a broken connection says nothing about the request being
			// wrong, only that we never learned the answer. Worth another try.
			logger.warn({ err: error, method }, "Could not reach Telegram");
			return {
				ok: false,
				retryable: true,
				optOut: false,
				description: error instanceof Error ? error.message : String(error),
			};
		} finally {
			clearTimeout(timeout);
		}
	}
}
