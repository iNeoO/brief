import { db } from "@brief/drizzle";
import { pinoLogger } from "@brief/infra/libs";
import {
	ArticlesService,
	CategoryJobsService,
	ProcessingService,
	S3Service,
} from "@brief/services";
import { env } from "./config/env.js";
import { createS3Config } from "./config/s3.js";
import { CategoryConsumer } from "./consumer.js";

const main = async (id: string, url: string, queue: string) => {
	const categoryJobsService = new CategoryJobsService(db);
	const processingService = new ProcessingService(
		new ArticlesService(db),
		categoryJobsService,
		db,
		new S3Service(db, createS3Config()),
	);

	const consumer = new CategoryConsumer(id, url, queue, "category", {
		categoryJobsService,
		processingService,
	});

	await consumer.init();

	let isShuttingDown = false;

	const gracefulShutdown = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		pinoLogger.info(`${signal} received. Graceful shutdown initiated.`);
		await consumer.end();
		await db.$client.end();
		process.exit(0);
	};

	process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
	process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};

main(env.WORKER_ID, env.AMQP_URL, env.CATEGORY_QUEUE);
