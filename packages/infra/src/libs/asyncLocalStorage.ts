import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "pino";
import { pinoLogger } from "./pino.js";

export const loggerStorage = new AsyncLocalStorage<Logger>();

export const getLoggerStore = () => {
	const logger = loggerStorage.getStore();
	if (!logger) {
		return pinoLogger;
	}
	return logger;
};
