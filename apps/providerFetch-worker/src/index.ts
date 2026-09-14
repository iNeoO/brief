import { createDb } from "@brief/drizzle";
import { AmqpPublisher, assertRetryTopology } from "@brief/infra/amqp";
import { pinoLogger } from "@brief/infra/libs";
import {
	ArticlesService,
	CategoryJobsService,
	IngestionService,
	ProviderFetchJobsService,
	ProvidersService,
} from "@brief/services";
import { env } from "./config/env.js";
import { ProviderFetchConsumer } from "./consumer.js";

const main = async (
	id: string,
	url: string,
	queue: string,
	categoryQueue: string,
) => {
	const db = createDb(env.PG_URL);
	const providersService = new ProvidersService(db);
	const articlesService = new ArticlesService(db);
	const ingestionService = new IngestionService(
		db,
		articlesService,
		providersService,
	);
	const providerFetchJobsService = new ProviderFetchJobsService(db);
	const categoryJobsService = new CategoryJobsService(db);

	const categoryPublisher = new AmqpPublisher({
		id,
		url,
		queue: categoryQueue,
	});

	// Publishes back into the holding queue, whose messages dead-letter into
	// `queue` once their own TTL expires. Declared with the retry shape: RabbitMQ
	// refuses a redeclaration whose arguments disagree with the first one.
	const retryPublisher = new AmqpPublisher({
		id,
		url,
		queue: `${queue}.retry`,
		assertTopology: (channel) => assertRetryTopology(channel, queue),
	});

	const consumer = new ProviderFetchConsumer(id, url, queue, "providerFetch", {
		providersService,
		providerFetchJobsService,
		categoryJobsService,
		ingestionService,
		categoryPublisher,
		retryPublisher,
	});

	// Before the consumer, so both queues exist by the time the first message can
	// fail rather than being declared on the way out.
	await categoryPublisher.init();
	await retryPublisher.init();
	await consumer.init();

	let isShuttingDown = false;

	const gracefulShutdown = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		pinoLogger.info(`${signal} received. Graceful shutdown initiated.`);
		await consumer.end();
		await categoryPublisher.close();
		await retryPublisher.close();
		await db.$client.end();
		process.exit(0);
	};

	process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
	process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};

main(env.WORKER_ID, env.AMQP_URL, env.PROVIDER_FETCH_QUEUE, env.CATEGORY_QUEUE);
