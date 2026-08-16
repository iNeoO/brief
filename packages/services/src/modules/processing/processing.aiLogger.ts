import type { PinoLogger } from "@brief/infra/libs";
import type { Logger as AiLogger } from "@tanstack/ai";

export const createAiDebugLogger = (logger: PinoLogger): AiLogger => ({
	debug: (message, meta) => logger.debug(meta, message),
	info: (message, meta) => logger.info(meta, message),
	warn: (message, meta) => logger.warn(meta, message),
	error: (message, meta) => logger.error(meta, message),
});
