import { createDb } from "@brief/drizzle";
import { AmqpPublisher, assertRetryTopology } from "@brief/infra/amqp";
import { pinoLogger } from "@brief/infra/libs";
import {
	ArticlesService,
	CategoryJobsService,
	MessageJobsService,
	ProcessingService,
	S3Service,
} from "@brief/services";
import { env } from "./config/env.js";
import { createS3Config } from "./config/s3.js";
import { CategoryConsumer } from "./consumer.js";

const main = async (id: string, url: string, queue: string) => {
	const db = createDb(env.PG_URL);
	const categoryJobsService = new CategoryJobsService(db);
	const processingService = new ProcessingService(
		new ArticlesService(db),
		categoryJobsService,
		db,
		new S3Service(db, createS3Config()),
	);

	const messagePublisher = new AmqpPublisher({
		id,
		url,
		queue: env.MESSAGE_JOB_QUEUE,
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

	const consumer = new CategoryConsumer(id, url, queue, "category", {
		categoryJobsService,
		processingService,
		messageJobsService: new MessageJobsService(db),
		messagePublisher,
		retryPublisher,
	});

	// Before the consumer, so the holding queue exists by the time the first
	// message can fail rather than being declared on the way out.
	await retryPublisher.init();
	await consumer.init();

	let isShuttingDown = false;

	const gracefulShutdown = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		pinoLogger.info(`${signal} received. Graceful shutdown initiated.`);
		await consumer.end();
		await messagePublisher.close();
		await retryPublisher.close();
		await db.$client.end();
		process.exit(0);
	};

	process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
	process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};

main(env.WORKER_ID, env.AMQP_URL, env.CATEGORY_QUEUE);
