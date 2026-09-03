import { db } from "@brief/drizzle";
import { pinoLogger } from "@brief/infra/libs";
import {
	ArticlesService,
	IngestionService,
	ProviderFetchJobsService,
	ProvidersService,
} from "@brief/services";
import { env } from "./config/env.js";
import { ProviderFetchConsumer } from "./consumer.js";

const main = async (id: string, url: string, queue: string) => {
	const providersService = new ProvidersService(db);
	const articlesService = new ArticlesService(db);
	const ingestionService = new IngestionService(
		db,
		articlesService,
		providersService,
	);
	const providerFetchJobsService = new ProviderFetchJobsService(db);

	const consumer = new ProviderFetchConsumer(id, url, queue, "providerFetch", {
		providersService,
		providerFetchJobsService,
		ingestionService,
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

main(env.WORKER_ID, env.AMQP_URL, env.PROVIDER_FETCH_QUEUE);
