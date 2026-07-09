import { db } from "@brief/drizzle";
import { pinoLogger } from "@brief/infra/libs";
import { env } from "./config/env.js";

const main = async (id: string, url: string, queue: string) => {
	const workersServices = new WorkersService(db);

	const taskConsumer = new TaskConsumer(
		id,
		url,
		queue,
		tasksServices,
		workersServices,
		redisService,
		statsService,
	);

	await statsService.init();
	await taskConsumer.init();

	let isShuttingDown = false;

	const gracefulShutdown = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		pinoLogger.info(`${signal} received. Graceful shutdown initiated.`);
		await db.$client.end();
		process.exit(0);
	};

	process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
	process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};

main(env.WORKER_ID, env.AMQP_URL, env.AMQP_QUEUE);
