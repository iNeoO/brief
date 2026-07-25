import { JOB_STATUS } from "@brief/common/constants";
import {
	type AmqpChannel,
	type AmqpMessage,
	BaseAmqpConsumer,
	safeParseCategoryMessage,
} from "@brief/infra/amqp";
import type { CategoryJobsService, ClaimedCategoryJob } from "@brief/services";

export class CategoryConsumer extends BaseAmqpConsumer {
	private services: {
		categoryJobsService: CategoryJobsService;
	};
	constructor(
		id: string,
		url: string,
		queue: string,
		name: string,
		services: {
			categoryJobsService: CategoryJobsService;
		},
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
		const job = await this.services.categoryJobsService.claimJob(jobId);
		if (!job) {
			this.logger.warn({ jobId }, "category job could not be claimed");
			channel.ack(msg);
			return;
		}

		try {
			await this.processCategoryJob(job);
		} catch (err) {
			this.logger.error({ err, jobId }, "category job failed");
			const message = err instanceof Error ? err.message : String(err);
			const updated = await this.services.categoryJobsService.incrementRetry(
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

		try {
			await this.services.categoryJobsService.markFinished(jobId);
		} catch (err) {
			this.logger.error({ err, jobId }, "failed to finalize category job");
		}

		channel.ack(msg);
	}

	// TODO(handler): générer le rapport + l'audio, envoyer le message,
	// et transitionner l'état jusqu'à CATEGORY_JOB_STATE.SENDING_MESSAGE.
	private async processCategoryJob(job: ClaimedCategoryJob) {
		this.logger.warn(
			{ jobId: job.id },
			"category job handler not implemented yet",
		);
	}
}
