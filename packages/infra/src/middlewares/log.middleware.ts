import { createFactory } from "hono/factory";
import type { LogsBindings } from "../factories/appWithLogs.js";
import { loggerStorage } from "../libs/asyncLocalStorage.js";
import { createHttpLogger, logHttpCompletion } from "../libs/pino.js";

const factory = createFactory<LogsBindings>();

const UNKNOWN_VALUE = "unknown";

export const logMiddleware = factory.createMiddleware(async (c, next) => {
	const startedAt = Date.now();
	const requestId = c.get("requestId");
	const bindings = {
		from: "http",
		reqId: requestId,
		req: {
			method: c.req.method,
			url: c.req.path,
		},
		userAgent: c.req.header("user-agent") || UNKNOWN_VALUE,
	};

	const logger = createHttpLogger(bindings);
	c.set("logger", logger);

	await loggerStorage.run(logger, async () => {
		await next();
		const durationMs = Date.now() - startedAt;
		logHttpCompletion(logger, c.res.status, durationMs);
	});
});
