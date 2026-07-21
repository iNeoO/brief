import {
	type AmqpChannel,
	type AmqpMessage,
	BaseAmqpConsumer,
	safeParseProviderFetchJobMessage,
} from "@brief/infra/amqp";
import type {
	IngestionService,
	ProviderFetchJobsService,
	ProvidersService,
} from "@brief/services";

export class ProviderFetchConsumer extends BaseAmqpConsumer {
	private services: {
		providersService: ProvidersService;
		providerFetchJobsService: ProviderFetchJobsService;
		ingestionService: IngestionService;
	};
	constructor(
		id: string,
		url: string,
		queue: string,
		name: string,
		services: {
			providersService: ProvidersService;
			providerFetchJobsService: ProviderFetchJobsService;
			ingestionService: IngestionService;
		},
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
			channel.ack(msg);
			return;
		}

		await this.services.ingestionService.ingestProvider(job.provider);

		channel.ack(msg);
	}
}
