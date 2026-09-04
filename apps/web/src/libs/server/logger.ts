import { randomUUID } from "node:crypto";
import { pinoLogger, wrapWithLogger } from "@brief/infra/libs";
import { createMiddleware } from "@tanstack/react-start";

/**
 * Services log through `getLoggerStore()`, an AsyncLocalStorage the workers fill
 * with a per-job logger. Nothing in `apps/web` filled it, so every service log
 * line first emitted "Logger store is not available" and then fell back to the
 * bare logger — noise in front of the real message, and on these paths the real
 * message only appears when something has already gone wrong.
 *
 * The id is minted here rather than taken from the request: there is no inbound
 * correlation header to honour, and its only job is to tie one request's lines
 * together.
 */
export const withRequestLogger = <T>(
	bindings: Record<string, string>,
	run: () => Promise<T>,
) =>
	wrapWithLogger(pinoLogger.child({ reqId: randomUUID(), ...bindings }), run);

/**
 * Chained into `errorHandlingMiddleware`, which every server function that
 * reaches a service goes through. Route handlers are not middleware, so they call
 * `withRequestLogger` themselves.
 */
export const loggerMiddleware = createMiddleware({ type: "function" }).server(
	({ next, serverFnMeta }) =>
		withRequestLogger({ serverFn: serverFnMeta.name }, next),
);
