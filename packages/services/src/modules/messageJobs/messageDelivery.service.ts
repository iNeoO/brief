import { JOB_STATUS } from "@brief/common/constants";
import type { Database } from "@brief/drizzle";
import { getLoggerStore } from "@brief/infra/libs";
import type { TelegramClient } from "../telegram/telegram.client.js";
import { optOutPairing } from "../telegram/telegram.service.js";
import {
	AUDIO_PERFORMER,
	buildAudioTitle,
	buildAudioUrl,
	buildCaption,
	retryDelayMs,
} from "./messageJobs.helper.js";
import type { MessageJobsService } from "./messageJobs.service.js";
import type {
	DeliveryVerdict,
	MessageDeliveryConfig,
} from "./messageJobs.type.js";

/**
 * Sends one brief to one reader on Telegram.
 *
 * It returns a verdict rather than acting on the queue: what a failure means for
 * RabbitMQ — acknowledge, delay, dead-letter — is the consumer's business, and
 * keeping it there is what stops `packages/services` learning about queues.
 */
export class MessageDeliveryService {
	constructor(
		private db: Database,
		private messageJobsService: MessageJobsService,
		private telegramClient: TelegramClient,
		private config: MessageDeliveryConfig,
	) {}

	async deliver(messageJobId: number): Promise<DeliveryVerdict> {
		const logger = getLoggerStore();
		const job = await this.messageJobsService.claim(messageJobId);

		if (!job) {
			return {
				outcome: "skipped",
				reason: "message job is not pending",
			};
		}

		// Read now, not at fan-out time: a reader can block the bot or withdraw the
		// authorisation between the moment their brief was scheduled and the moment
		// it goes out, and a delayed retry makes that gap minutes wide. A pairing
		// that has been deleted outright counts the same as an opted-out one.
		if (!job.pairing || job.pairing.status !== "verified") {
			await this.messageJobsService.markFailed(
				messageJobId,
				"reader opted out",
			);
			return { outcome: "opted-out" };
		}

		if (!job.audioFileId) {
			const reason = `category job ${job.categoryJobId} has no audio file to send`;
			await this.messageJobsService.markFailed(messageJobId, reason);
			return { outcome: "failed", reason };
		}

		const isFirst = await this.messageJobsService.claimAnnouncement({
			id: job.id,
			userId: job.userId,
			targetDate: job.targetDate,
			known: job.isFirst,
		});

		const result = await this.telegramClient.sendAudio({
			chatId: job.pairing.chatId,
			audioUrl: buildAudioUrl(this.config.siteUrl, job.audioFileId),
			caption: buildCaption({
				locale: job.pairing.locale,
				categoryName: job.categoryName,
				targetDate: job.targetDate,
				isFirst,
			}),
			title: buildAudioTitle({
				categoryName: job.categoryName,
				targetDate: job.targetDate,
				locale: job.pairing.locale,
			}),
			performer: AUDIO_PERFORMER,
		});

		if (result.ok) {
			await this.messageJobsService.markFinished(messageJobId);
			logger.info(
				{ messageJobId, categoryJobId: job.categoryJobId, isFirst },
				"brief delivered on Telegram",
			);
			return { outcome: "sent" };
		}

		const reason = `Telegram refused the send${
			result.status ? ` (${result.status})` : ""
		}: ${result.description ?? "no description"}`;

		// A closed chat is the one failure the webhook cannot always catch: a reader
		// who blocks the bot while nothing is listening leaves no trace until we try
		// to write to them.
		if (result.optOut) {
			await optOutPairing(this.db, job.pairing.chatId);
			await this.messageJobsService.markFailed(messageJobId, reason);
			logger.info(
				{ messageJobId },
				"Telegram closed the chat, ending the pairing",
			);
			return { outcome: "opted-out" };
		}

		if (!result.retryable) {
			await this.messageJobsService.markFailed(messageJobId, reason);
			return { outcome: "failed", reason };
		}

		const updated = await this.messageJobsService.incrementRetry(
			messageJobId,
			reason,
		);

		if (!updated || updated.status === JOB_STATUS.FAILED) {
			return { outcome: "failed", reason };
		}

		return {
			outcome: "retry",
			delayMs: retryDelayMs(updated.retry, result.retryAfterMs),
		};
	}
}
