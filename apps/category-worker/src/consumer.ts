import {
	type AmqpChannel,
	type AmqpMessage,
	BaseAmqpConsumer,
	safeParseCategoryMessage,
} from "@brief/infra/amqp";
import type { CategoryJobsService, IngestionService } from "@brief/services";

export class CategoryConsumer extends BaseAmqpConsumer {
	private services: {
		categoryJobsService: CategoryJobsService;
		ingestionService: IngestionService;
	};
	constructor(
		id: string,
		url: string,
		queue: string,
		name: string,
		services: {
			categoryJobsService: CategoryJobsService;
			ingestionService: IngestionService;
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
			this.logger.warn({ jobId }, "Category job could not be claimed");
			channel.ack(msg);
			return;
		}

		await Promise.all(
			job.category.providers.map((provider) =>
				this.services.ingestionService.ingestProvider(provider),
			),
		);

		channel.ack(msg);
	}
}
