import { pinoLogger } from "@brief/infra/libs";
import { env } from "./config/env.js";
import { MessageConsumer } from "./consumer.js";

const main = async (id: string, url: string, queue: string) => {
	const consumer = new MessageConsumer({ id, url, queue, name: "message-job" });

	await consumer.init();

	let isShuttingDown = false;

	const gracefulShutdown = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		pinoLogger.info(`${signal} received. Graceful shutdown initiated.`);
		await consumer.end();
		process.exit(0);
	};

	process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
	process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};

main(env.WORKER_ID, env.AMQP_URL, env.MESSAGE_JOB_QUEUE);
