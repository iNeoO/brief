import type { PinoLogger } from "@brief/infra/libs";
import type { Logger as AiLogger } from "@tanstack/ai";

/**
 * `@tanstack/ai`'s `Logger` takes `(message, meta)`; pino takes
 * `(mergingObject, message)`. This just flips the arguments so `chat()`'s
 * debug output (tool calls, agent-loop iterations, outgoing requests) lands
 * on the same pino logger as everything else, gated by the same LOG_LEVEL.
 */
export const createAiDebugLogger = (logger: PinoLogger): AiLogger => ({
	debug: (message, meta) => logger.debug(meta, message),
	info: (message, meta) => logger.info(meta, message),
	warn: (message, meta) => logger.warn(meta, message),
	error: (message, meta) => logger.error(meta, message),
});
