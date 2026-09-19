import {
	CATEGORY_RETRY_DELAYS_MS,
	INTERNAL_ERROR_CODE,
	JOB_STATUS,
} from "@brief/common/constants";
import type { InternalErrorCode } from "@brief/common/types";
import { retryDelayFromTiers } from "@brief/common/utils";
import {
	type AmqpChannel,
	type AmqpMessage,
	type AmqpPublisher,
	BaseAmqpConsumer,
	retryDeathCount,
	safeParseCategoryMessage,
} from "@brief/infra/amqp";
import { InternalError } from "@brief/infra/errors";
import type {
	CategoryJobsService,
	MessageJobsService,
	ProcessingService,
} from "@brief/services";

const NON_RETRYABLE_ERROR_CODES = new Set<InternalErrorCode>([
	INTERNAL_ERROR_CODE.CATEGORY_JOB_UNKNOWN_STATE,
	INTERNAL_ERROR_CODE.CATEGORY_JOB_CATEGORY_NOT_FOUND,
	// A missing audio file will not appear on the second attempt. Burning three
	// tries before saying so only delays the error.
	INTERNAL_ERROR_CODE.CATEGORY_JOB_MISSING_AUDIO,
]);

const isRetryable = (err: unknown) =>
	!(err instanceof InternalError) || !NON_RETRYABLE_ERROR_CODES.has(err.code);

const retryDelayMs = (attempt: number) =>
	retryDelayFromTiers(CATEGORY_RETRY_DELAYS_MS, attempt);

/**
 * How many trips through the holding queue a finished job's fan-out may make
 * before the message is dead-lettered instead.
 *
 * The category job's own retry counter stops applying once the job is finished,
 * so nothing else bounds that cycle: a permanently broken fan-out would defer
 * the same message every minute for as long as the broker lives. The tally comes
 * from `x-death`, which every deferral for this queue shares, so a job that
 * spent its three pipeline retries arrives here with three already on the
 * clock — the figure leaves room for both.
 */
const MAX_HOLDING_QUEUE_TRIPS = 10;

type CategoryConsumerServices = {
	categoryJobsService: CategoryJobsService;
	processingService: ProcessingService;
	messageJobsService: MessageJobsService;
	messagePublisher: AmqpPublisher;
	retryPublisher: AmqpPublisher;
};

export class CategoryConsumer extends BaseAmqpConsumer {
	private services: CategoryConsumerServices;

	constructor(
		id: string,
		url: string,
		queue: string,
		name: string,
		services: CategoryConsumerServices,
	) {
		super({ id, url, queue, name });
		this.services = services;
	}

	protected async handleMessage(channel: AmqpChannel, msg: AmqpMessage) {
		const result = safeParseCategoryMessage(msg.content);
		if (result.error) {
			this.logger.error(
				{ err: result.error, raw: msg.content.toString("utf-8") },
				"Error parsing queue message",
			);
			channel.nack(msg, false, false);
			return;
		}

		const jobId = result.data.id;

		let job: Awaited<ReturnType<CategoryJobsService["claimJob"]>>;
		try {
			job = await this.services.categoryJobsService.claimJob(jobId);
		} catch (err) {
			await this.failJob(channel, msg, jobId, err);
			return;
		}

		if (!job) {
			this.logger.warn({ jobId }, "category job is not pending, skipping");
			// Not only a skip: this is also where a crash between `markFinished` and
			// the fan-out is repaired. RabbitMQ redelivers the message, the job is no
			// longer claimable, and without this the brief would be produced,
			// published on the site, and delivered to nobody. `fanOut` ignores a job
			// that is not finished, so the ordinary duplicate stays a no-op.
			await this.publishDelivery(channel, msg, jobId);
			return;
		}

		try {
			await this.services.processingService.runCategoryJob(job);

			const [finished] =
				await this.services.categoryJobsService.markFinished(jobId);

			if (!finished) {
				throw new InternalError({
					code: INTERNAL_ERROR_CODE.CATEGORY_JOB_STATE_CONFLICT,
					message: `Category job ${jobId} could not be marked finished`,
				});
			}
		} catch (err) {
			await this.failJob(channel, msg, jobId, err);
			return;
		}

		// Deliberately outside the try above: the job is finished now, and
		// `failJob` would put it back to `pending` and replay the whole pipeline —
		// LLM and text-to-speech included — over a queue that was briefly down.
		await this.publishDelivery(channel, msg, jobId);
	}

	/**
	 * Creates the delivery rows for this brief and publishes one message per
	 * reader. Acks on success; on failure defers the message without touching the
	 * category job, so the redelivery comes back through the branch above and
	 * tries again.
	 */
	private async publishDelivery(
		channel: AmqpChannel,
		msg: AmqpMessage,
		jobId: number,
	) {
		try {
			const messageJobIds =
				await this.services.messageJobsService.fanOut(jobId);

			for (const id of messageJobIds) {
				await this.services.messagePublisher.publish({ id });
			}

			if (messageJobIds.length > 0) {
				this.logger.info(
					{ jobId, deliveries: messageJobIds.length },
					"published brief deliveries",
				);
			}

			channel.ack(msg);
		} catch (err) {
			this.logger.error({ err, jobId }, "could not publish brief deliveries");

			const trips = retryDeathCount(msg, this.queue);
			if (trips >= MAX_HOLDING_QUEUE_TRIPS) {
				this.logger.error(
					{ jobId, trips },
					"giving up on publishing brief deliveries",
				);
				channel.nack(msg, false, false);
				return;
			}

			// The job is finished, so its retry counter no longer applies: wait the
			// first tier and come back through the `!job` branch above.
			await this.deferRetry(channel, msg, jobId, retryDelayMs(1));
		}
	}

	/**
	 * Hands the message to the holding queue, where it waits `delayMs` before
	 * dead-lettering back here, and acks the copy in hand. `nack(requeue = true)`
	 * would redeliver at once instead: every attempt burnt within seconds, one
	 * paid-for LLM call each, and a rate limiter given no time to relent.
	 *
	 * Published before the ack. A crash in between duplicates the message, which
	 * `claimJob` absorbs; the reverse order would lose it.
	 */
	private async deferRetry(
		channel: AmqpChannel,
		msg: AmqpMessage,
		jobId: number,
		delayMs: number,
	) {
		try {
			await this.services.retryPublisher.publish({ id: jobId }, { delayMs });
			this.logger.warn({ jobId, delayMs }, "category job deferred");
			channel.ack(msg);
		} catch (err) {
			this.logger.error({ err, jobId }, "could not defer category job");
			// The holding queue never took the message, so nothing else would ever
			// drive this job again. An immediate redelivery is the lesser evil.
			channel.nack(msg, false, true);
		}
	}

	private async failJob(
		channel: AmqpChannel,
		msg: AmqpMessage,
		jobId: number,
		err: unknown,
	) {
		this.logger.error({ err, jobId }, "category job failed");
		const message = err instanceof Error ? err.message : String(err);

		try {
			const updated = isRetryable(err)
				? await this.services.categoryJobsService.incrementRetry(jobId, message)
				: await this.services.categoryJobsService.markFailed(jobId, message);

			// Out of tries, or a failure no second attempt would survive: dead-letter
			// it and leave the row where the bookkeeping just put it.
			if (updated?.status !== JOB_STATUS.PENDING) {
				channel.nack(msg, false, false);
				return;
			}

			await this.deferRetry(channel, msg, jobId, retryDelayMs(updated.retry));
		} catch (bookkeepingErr) {
			this.logger.error(
				{ err: bookkeepingErr, jobId },
				"failed to record category job failure",
			);
			channel.nack(msg, false, false);
		}
	}
}
