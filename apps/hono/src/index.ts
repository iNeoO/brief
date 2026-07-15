import type { LogsBindings } from "@brief/infra/factories";
import { pinoLogger } from "@brief/infra/libs";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createApp } from "./app.js";
import { setupOpenAPI } from "./libs/openAPI.js";
import { services } from "./services/container.js";

const apiApp = createApp(services);
setupOpenAPI(apiApp);
const app = new Hono<LogsBindings>();
app.notFound((c) =>
	c.json({ code: "NOT_FOUND", error: "Page not found" }, 404),
);
app.route("/api", apiApp);

const server = serve(
	{
		fetch: app.fetch,
		port: 4000,
	},
	(info) => {
		pinoLogger.info(`Server is running on http://localhost:${info.port}`);
	},
);

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
	if (isShuttingDown) return;
	isShuttingDown = true;
	pinoLogger.info(`${signal} received. Graceful shutdown initiated.`);

	await new Promise<void>((resolve, reject) => {
		server.close((err) => {
			if (err) reject(err);
			else {
				pinoLogger.info("HTTP server closed");
				resolve();
			}
		});
	});

	await services.db.$client.end();
};

const handleShutdown = (signal: string) => {
	gracefulShutdown(signal)
		.then(() => process.exit(0))
		.catch((error) => {
			pinoLogger.error(error, "Graceful shutdown failed");
			process.exit(1);
		});
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
