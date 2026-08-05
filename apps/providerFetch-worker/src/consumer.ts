import { JOB_STATUS } from "@brief/common/constants";
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

export class ProviderFetchConsumer extends BaseAmqpConsumer {
	private services: {
		providersService: ProvidersService;
		providerFetchJobsService: ProviderFetchJobsService;
		categoryJobsService: CategoryJobsService;
		ingestionService: IngestionService;
	};
	private categoryPublisher: AmqpPublisher;
	constructor(
		id: string,
		url: string,
		queue: string,
		name: string,
		services: {
			providersService: ProvidersService;
			providerFetchJobsService: ProviderFetchJobsService;
			categoryJobsService: CategoryJobsService;
			ingestionService: IngestionService;
		},
		categoryPublisher: AmqpPublisher,
	) {
		super({ id, url, queue, name });
		this.services = services;
		this.categoryPublisher = categoryPublisher;
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
			channel.ack(msg);
			return;
		}

		try {
			await this.processProviderFetchJob(job);
			await this.services.providerFetchJobsService.markFinished(jobId);
			await this.publishReadyCategoryJobs(jobId);
		} catch (err) {
			this.logger.error({ err, jobId }, "provider fetch job failed");
			const message = err instanceof Error ? err.message : String(err);
			const updated =
				await this.services.providerFetchJobsService.incrementRetry(
					jobId,
					message,
				);

			if (updated?.status === JOB_STATUS.PENDING) {
				channel.nack(msg, false, true); // retry : requeue
			} else {
				channel.nack(msg, false, false); // épuisé : DLQ
			}
			return;
		}

		channel.ack(msg);
	}

	private async processProviderFetchJob(job: ClaimedProviderFetchJob) {
		await this.services.ingestionService.ingestProvider(job.id, job.provider);
	}

	private async publishReadyCategoryJobs(providerFetchJobId: number) {
		const candidates =
			await this.services.categoryJobsService.findWaitingByProviderFetchJob(
				providerFetchJobId,
			);

		for (const candidate of candidates) {
			const allFinished =
				await this.services.providerFetchJobsService.areAllProvidersFinished(
					candidate.id,
				);
			if (!allFinished) continue;

			const [ready] =
				await this.services.categoryJobsService.markReadyForProcessing(
					candidate.id,
				);
			if (ready) {
				await this.categoryPublisher.publish({ id: ready.id });
			}
		}
	}
}
