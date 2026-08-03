import { API_ERROR, JOB_STATUS } from "@brief/common/constants";
import type { APIError } from "@brief/common/types";
import {
	type AmqpChannel,
	type AmqpMessage,
	BaseAmqpConsumer,
	safeParseCategoryMessage,
} from "@brief/infra/amqp";
import { InternalError } from "@brief/infra/errors";
import type { CategoryJobsService, ProcessingService } from "@brief/services";

const NON_RETRYABLE_ERROR_CODES = new Set<APIError>([
	API_ERROR.CATEGORY_JOB_UNKNOWN_STATE,
]);

const isRetryable = (err: unknown) =>
	!(err instanceof InternalError) || !NON_RETRYABLE_ERROR_CODES.has(err.code);

type CategoryConsumerServices = {
	categoryJobsService: CategoryJobsService;
	processingService: ProcessingService;
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
			channel.ack(msg);
			return;
		}

		try {
			await this.services.processingService.runCategoryJob(job);

			const [finished] =
				await this.services.categoryJobsService.markFinished(jobId);

			if (!finished) {
				throw new InternalError({
					code: API_ERROR.CATEGORY_JOB_STATE_CONFLICT,
					message: `Category job ${jobId} could not be marked finished`,
				});
			}
		} catch (err) {
			await this.failJob(channel, msg, jobId, err);
			return;
		}

		channel.ack(msg);
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

			channel.nack(msg, false, updated?.status === JOB_STATUS.PENDING);
		} catch (bookkeepingErr) {
			this.logger.error(
				{ err: bookkeepingErr, jobId },
				"failed to record category job failure",
			);
			channel.nack(msg, false, false);
		}
	}
}
