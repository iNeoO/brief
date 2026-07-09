import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "pino";
import { pinoLogger } from "./pino.js";

export const loggerStorage = new AsyncLocalStorage<Logger>();

export const getLoggerStore = () => {
	const logger = loggerStorage.getStore();
	if (!logger) {
		pinoLogger.warn("Logger store is not available. Returning default logger.");
		return pinoLogger;
	}
	return logger;
};

export const wrapWithLogger = async <T>(logger: Logger, cb: () => Promise<T>) =>
	await loggerStorage.run(logger, cb);
