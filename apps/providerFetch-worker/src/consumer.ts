import {
	JOB_STATUS,
	PROVIDER_FETCH_RETRY_DELAYS_MS,
} from "@brief/common/constants";
import { retryDelayFromTiers } from "@brief/common/utils";
import {
	type AmqpChannel,
	type AmqpMessage,
	type AmqpPublisher,
	BaseAmqpConsumer,
	safeParseProviderFetchJobMessage,
} from "@brief/infra/amqp";
import type {
	CategoryJobsService,
	ClaimedProviderFetchJob,
	IngestionService,
	ProviderFetchJobsService,
	ProvidersService,
} from "@brief/services";

const retryDelayMs = (attempt: number) =>
	retryDelayFromTiers(PROVIDER_FETCH_RETRY_DELAYS_MS, attempt);

type ProviderFetchConsumerServices = {
	providersService: ProvidersService;
	providerFetchJobsService: ProviderFetchJobsService;
	categoryJobsService: CategoryJobsService;
	ingestionService: IngestionService;
	categoryPublisher: AmqpPublisher;
	// Both publishers have the same type, so they are named rather than passed
	// positionally: swapping them would still compile.
	retryPublisher: AmqpPublisher;
};

export class ProviderFetchConsumer extends BaseAmqpConsumer {
	private readonly services: ProviderFetchConsumerServices;

	constructor(
		id: string,
		url: string,
		queue: string,
		name: string,
		services: ProviderFetchConsumerServices,
	) {
		super({ id, url, queue, name });
		this.services = services;
	}

	protected async handleMessage(channel: AmqpChannel, msg: AmqpMessage) {
		const result = safeParseProviderFetchJobMessage(msg.content);
		if (result.error) {
			this.logger.error(
				{ err: result.error, raw: msg.content.toString("utf-8") },
				"Error parsing queue message",
			);
			channel.nack(msg, false, false);
			return;
		}
		const jobId = result.data.id;
		const job = await this.services.providerFetchJobsService.claimJob(jobId);
		if (!job) {
			this.logger.warn({ jobId }, "provider fetch job could not be claimed");
			if (await this.releaseDependents(channel, msg, jobId)) {
				channel.ack(msg);
			}
			return;
		}

		try {
			await this.processProviderFetchJob(job);
			await this.services.providerFetchJobsService.markFinished(jobId);
		} catch (err) {
			this.logger.error({ err, jobId }, "provider fetch job failed");
			const message = err instanceof Error ? err.message : String(err);
			const updated =
				await this.services.providerFetchJobsService.incrementRetry(
					jobId,
					message,
				);

			if (updated?.status === JOB_STATUS.PENDING) {
				await this.deferRetry(channel, msg, jobId, retryDelayMs(updated.retry));
				return;
			}

			if (updated?.status === JOB_STATUS.FAILED) {
				if (await this.releaseDependents(channel, msg, jobId)) {
					channel.nack(msg, false, false);
				}
				return;
			}

			channel.nack(msg, false, false);
			return;
		}

		if (await this.releaseDependents(channel, msg, jobId)) {
			channel.ack(msg);
		}
	}

	private async releaseDependents(
		channel: AmqpChannel,
		msg: AmqpMessage,
		jobId: number,
	): Promise<boolean> {
		try {
			await this.settleWaitingDependents(jobId);
			return true;
		} catch (err) {
			this.logger.error(
				{ err, jobId },
				"could not settle the category jobs waiting on this fetch",
			);
			await this.deferRetry(channel, msg, jobId, retryDelayMs(1));
			return false;
		}
	}

	/**
	 * Hands the message to the holding queue, where it waits `delayMs` before
	 * dead-lettering back here, and acks the copy in hand. `nack(requeue = true)`
	 * would redeliver at once instead: every attempt spent within seconds, each
	 * one hitting a feed that has just failed to answer.
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
			this.logger.warn({ jobId, delayMs }, "provider fetch job deferred");
			channel.ack(msg);
		} catch (err) {
			this.logger.error({ err, jobId }, "could not defer provider fetch job");
			// The holding queue never took the message, so nothing else would ever
			// drive this job again — and the category jobs waiting on it would sit in
			// `waiting_for_providers` for good. An immediate redelivery is the lesser
			// evil.
			channel.nack(msg, false, true);
		}
	}

	private async processProviderFetchJob(job: ClaimedProviderFetchJob) {
		await this.services.ingestionService.ingestProvider(job.id, job.provider);
	}

	private async settleWaitingDependents(providerFetchJobId: number) {
		const waiting =
			await this.services.categoryJobsService.findWaitingByProviderFetchJob(
				providerFetchJobId,
			);

		for (const dependent of waiting) {
			const verdict = await this.services.categoryJobsService.releaseWaitingJob(
				dependent.id,
			);

			const context = {
				jobId: dependent.id,
				category: dependent.category,
				targetDate: dependent.targetDate,
				failedProviders:
					verdict.outcome === "waiting" ? [] : verdict.failedProviders,
			};

			switch (verdict.outcome) {
				case "waiting":
					break;

				case "ready":
					await this.services.categoryPublisher.publish({ id: dependent.id });

					if (verdict.failedProviders.length > 0) {
						this.logger.warn(context, "brief released without every source");
					}
					break;

				case "failed":
					this.logger.error(
						{ ...context, reason: verdict.error },
						"no provider produced an article, category job failed",
					);
					break;
			}
		}
	}
}
