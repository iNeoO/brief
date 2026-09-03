import { db } from "@brief/drizzle";
import { pinoLogger } from "@brief/infra/libs";
import { CategoryJobsService } from "@brief/services";
import { env } from "./config/env.js";
import { CategoryConsumer } from "./consumer.js";

const main = async (id: string, url: string, queue: string) => {
	const categoryJobsService = new CategoryJobsService(db);

	const consumer = new CategoryConsumer(id, url, queue, "category", {
		categoryJobsService,
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
