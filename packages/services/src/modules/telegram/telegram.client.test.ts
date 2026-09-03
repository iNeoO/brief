import { wrapWithLogger } from "@brief/infra/libs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramClient } from "./telegram.client.js";

const BOT_TOKEN = "123456:super-secret-token";

const client = new TelegramClient({
	botToken: BOT_TOKEN,
	botUsername: "Dailybriefs_fr_dev_bot",
});

const logged: unknown[] = [];

// `pino` is not a direct dependency here, so the type comes from the function
// that consumes it rather than from an import.
const logger = {
	warn: (...args: unknown[]) => logged.push(args),
	info: () => {},
	error: () => {},
	debug: () => {},
} as unknown as Parameters<typeof wrapWithLogger>[0];

const send = () =>
	wrapWithLogger(logger, () =>
		client.sendAudio({
			chatId: "42",
			audioUrl: "https://dailybriefs.fr/api/briefs/audio/file-1",
			caption: "Voici l'audio pour le topic Tech.",
			title: "Tech — 28 août 2026",
			performer: "Daily Briefs",
		}),
	);

const say = () =>
	wrapWithLogger(logger, () =>
		client.sendMessage({ chatId: "42", text: "C'est fait." }),
	);

const respond = (status: number, body: unknown) =>
	vi
		.spyOn(globalThis, "fetch")
		.mockResolvedValue(
			new Response(JSON.stringify(body), { status }) as Response,
		);

beforeEach(() => {
	logged.length = 0;
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("TelegramClient", () => {
	it("posts a text message to the sendMessage endpoint", async () => {
		const fetchSpy = respond(200, { ok: true });

		await expect(say()).resolves.toEqual({ ok: true });

		const [url, init] = fetchSpy.mock.calls[0] ?? [];
		expect(url).toContain("/sendMessage");
		expect(JSON.parse(String(init?.body))).toEqual({
			chat_id: "42",
			text: "C'est fait.",
		});
	});

	it("reports a success", async () => {
		respond(200, { ok: true, result: {} });

		await expect(send()).resolves.toEqual({ ok: true });
	});

	it("waits as long as a 429 asks", async () => {
		respond(429, {
			description: "Too Many Requests: retry after 12",
			parameters: { retry_after: 12 },
		});

		await expect(send()).resolves.toMatchObject({
			ok: false,
			retryable: true,
			optOut: false,
			retryAfterMs: 12_000,
		});
	});

	it("still pauses on a 429 that names no delay", async () => {
		respond(429, { description: "Too Many Requests" });

		await expect(send()).resolves.toMatchObject({
			retryable: true,
			retryAfterMs: 1_000,
		});
	});

	it("retries a server-side failure", async () => {
		respond(502, { description: "Bad Gateway" });

		await expect(send()).resolves.toMatchObject({
			ok: false,
			retryable: true,
			optOut: false,
		});
	});

	// The failure the webhook cannot always catch: a reader who blocks the bot
	// while nothing is listening leaves no trace until we try to write to them.
	it("ends the pairing when the reader has blocked the bot", async () => {
		respond(403, { description: "Forbidden: bot was blocked by the user" });

		await expect(send()).resolves.toMatchObject({
			ok: false,
			retryable: false,
			optOut: true,
		});
	});

	it("ends the pairing when the chat no longer resolves", async () => {
		respond(400, { description: "Bad Request: chat not found" });

		await expect(send()).resolves.toMatchObject({
			retryable: false,
			optOut: true,
		});
	});

	it("gives up on a bad request without touching the pairing", async () => {
		respond(400, { description: "Bad Request: wrong file identifier" });

		await expect(send()).resolves.toMatchObject({
			retryable: false,
			optOut: false,
		});
	});

	it("retries when the answer never arrived", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(
			new DOMException("The operation was aborted.", "AbortError"),
		);

		await expect(send()).resolves.toMatchObject({
			ok: false,
			retryable: true,
			optOut: false,
		});
	});

	it("survives an error body that is not the JSON we expect", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("<html>502</html>", { status: 502 }) as Response,
		);

		await expect(send()).resolves.toMatchObject({ retryable: true });
	});

	// The token rides in the URL because that is where Telegram's API puts it.
	// Anything logged here would leak it into whatever collects the logs.
	it("never logs the token", async () => {
		respond(403, { description: "Forbidden: bot was blocked by the user" });
		await send();

		expect(logged.length).toBeGreaterThan(0);
		expect(JSON.stringify(logged)).not.toContain(BOT_TOKEN);
	});
});
