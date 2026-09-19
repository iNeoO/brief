import { JOB_STATUS, LOCALE } from "@brief/common/constants";
import type { Database } from "@brief/drizzle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TelegramClient } from "../telegram/telegram.client.js";
import { MessageDeliveryService } from "./messageDelivery.service.js";
import type { MessageJobsService } from "./messageJobs.service.js";
import type { ClaimedMessageJob } from "./messageJobs.type.js";

const optOutPairing = vi.fn();

vi.mock("../telegram/telegram.service.js", () => ({
	optOutPairing: (...args: unknown[]) => optOutPairing(...args),
}));

const MESSAGE_JOB_ID = 7;

const claimed = (overrides: Partial<ClaimedMessageJob> = {}) =>
	({
		id: MESSAGE_JOB_ID,
		categoryJobId: 42,
		userId: "user-1",
		retry: 0,
		isFirst: null,
		pairing: { chatId: "chat-1", locale: LOCALE.FR, status: "verified" },
		categoryName: "Actu France",
		targetDate: new Date("2026-08-28T00:00:00.000Z"),
		audioFileId: "file-1",
		...overrides,
	}) satisfies ClaimedMessageJob;

const claim = vi.fn();
const claimAnnouncement = vi.fn();
const markFinished = vi.fn();
const markFailed = vi.fn();
const incrementRetry = vi.fn();
const sendAudio = vi.fn();

const service = () =>
	new MessageDeliveryService(
		{} as unknown as Database,
		{
			claim,
			claimAnnouncement,
			markFinished,
			markFailed,
			incrementRetry,
		} as unknown as MessageJobsService,
		{ sendAudio } as unknown as TelegramClient,
		{ siteUrl: "https://dailybriefs.fr" },
	);

beforeEach(() => {
	vi.clearAllMocks();
	claim.mockResolvedValue(claimed());
	claimAnnouncement.mockResolvedValue(false);
	sendAudio.mockResolvedValue({ ok: true });
});

describe("deliver", () => {
	it("sends the audio by link and marks the job finished", async () => {
		claimAnnouncement.mockResolvedValue(true);

		await expect(service().deliver(MESSAGE_JOB_ID)).resolves.toEqual({
			outcome: "sent",
		});

		expect(sendAudio).toHaveBeenCalledWith({
			chatId: "chat-1",
			audioUrl: "https://dailybriefs.fr/api/briefs/audio/file-1",
			caption:
				"Voici vos sujets pour la journée du 28 août 2026.\n\nVoici l'audio pour le topic Actu France.",
			title: "Actu France — 28 août 2026",
			performer: "Daily Briefs",
		});
		expect(markFinished).toHaveBeenCalledWith(MESSAGE_JOB_ID);
	});

	// RabbitMQ redelivers; a job somebody else already took is a no-op, not a
	// second message to the reader.
	it("skips a job it could not claim", async () => {
		claim.mockResolvedValue(undefined);

		await expect(service().deliver(MESSAGE_JOB_ID)).resolves.toMatchObject({
			outcome: "skipped",
		});
		expect(sendAudio).not.toHaveBeenCalled();
	});

	// The reader can block the bot between the fan-out and the send, and a delayed
	// retry makes that gap minutes wide.
	it("stops for a reader who unsubscribed since the fan-out", async () => {
		claim.mockResolvedValue(
			claimed({
				pairing: { chatId: "chat-1", locale: LOCALE.FR, status: "opted_out" },
			}),
		);

		await expect(service().deliver(MESSAGE_JOB_ID)).resolves.toEqual({
			outcome: "opted-out",
		});
		expect(sendAudio).not.toHaveBeenCalled();
		expect(markFailed).toHaveBeenCalledWith(MESSAGE_JOB_ID, "reader opted out");
	});

	// Withdrawing the authorisation deletes the pairing row: no join result, and
	// nothing to send to.
	it("stops for a reader whose pairing has been deleted", async () => {
		claim.mockResolvedValue(claimed({ pairing: null }));

		await expect(service().deliver(MESSAGE_JOB_ID)).resolves.toEqual({
			outcome: "opted-out",
		});
		expect(sendAudio).not.toHaveBeenCalled();
	});

	it("fails a job whose audio never landed", async () => {
		claim.mockResolvedValue(claimed({ audioFileId: null }));

		await expect(service().deliver(MESSAGE_JOB_ID)).resolves.toMatchObject({
			outcome: "failed",
		});
		expect(sendAudio).not.toHaveBeenCalled();
	});

	it("ends the pairing when Telegram closes the chat", async () => {
		sendAudio.mockResolvedValue({
			ok: false,
			retryable: false,
			optOut: true,
			status: 403,
			description: "Forbidden: bot was blocked by the user",
		});

		await expect(service().deliver(MESSAGE_JOB_ID)).resolves.toEqual({
			outcome: "opted-out",
		});
		expect(optOutPairing).toHaveBeenCalledWith(expect.anything(), "chat-1");
	});

	it("defers a rate-limited send for as long as Telegram asked", async () => {
		sendAudio.mockResolvedValue({
			ok: false,
			retryable: true,
			optOut: false,
			status: 429,
			retryAfterMs: 12_000,
		});
		incrementRetry.mockResolvedValue({ retry: 1, status: JOB_STATUS.PENDING });

		await expect(service().deliver(MESSAGE_JOB_ID)).resolves.toEqual({
			outcome: "retry",
			delayMs: 12_000,
		});
	});

	it("gives up once the attempts run out", async () => {
		sendAudio.mockResolvedValue({ ok: false, retryable: true, optOut: false });
		incrementRetry.mockResolvedValue({ retry: 3, status: JOB_STATUS.FAILED });

		await expect(service().deliver(MESSAGE_JOB_ID)).resolves.toMatchObject({
			outcome: "failed",
		});
	});

	it("does not retry a request Telegram will refuse again", async () => {
		sendAudio.mockResolvedValue({
			ok: false,
			retryable: false,
			optOut: false,
			status: 400,
			description: "Bad Request: wrong file identifier",
		});

		await expect(service().deliver(MESSAGE_JOB_ID)).resolves.toMatchObject({
			outcome: "failed",
		});
		expect(incrementRetry).not.toHaveBeenCalled();
		expect(markFailed).toHaveBeenCalled();
	});

	// The bug this guards: recomputing `isFirst` on a retry finds the announcement
	// row already there — put there by this very job — and drops the opening line
	// the reader never received.
	it("keeps the announcement it already won across a retry", async () => {
		claim.mockResolvedValue(claimed({ retry: 1, isFirst: true }));

		await service().deliver(MESSAGE_JOB_ID);

		expect(claimAnnouncement).toHaveBeenCalledWith(
			expect.objectContaining({ known: true }),
		);
	});
});
