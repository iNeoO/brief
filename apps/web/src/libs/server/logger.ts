import { randomUUID } from "node:crypto";
import { loggerStorage, pinoLogger, wrapWithLogger } from "@brief/infra/libs";
import { createMiddleware, createServerOnlyFn } from "@tanstack/react-start";

/**
 * Services log through `getLoggerStore()`, an AsyncLocalStorage the workers fill
 * with a per-job logger. Nothing in `apps/web` filled it, so every service log
 * line first emitted "Logger store is not available" and then fell back to the
 * bare logger — noise in front of the real message, and on these paths the real
 * message only appears when something has already gone wrong.
 *
 * The request logger, and with it the `reqId`, is put in place by
 * `httpLoggerMiddleware` for every request. This adds bindings to it, so the
 * lines of a server function and the HTTP line of the request that carried it
 * share one id. The fallback branch mints an id of its own, for the one caller
 * that runs outside the Start handler: a unit test, or a script.
 *
 * `createServerOnlyFn` is what keeps this off the client, and it is load-bearing
 * rather than tidiness. `loggerMiddleware` below is named in the middleware
 * chain of every server function, and a chain is part of the client half of
 * `createServerFn` — so this module is in the browser bundle whatever we do.
 * Without the wrapper the body stays too, and with it `pinoLogger`, which drags
 * `pino-pretty` in: Node-only code that reads the bare `global` and throws while
 * the bundle is still evaluating. Nothing hydrates after that, so every form on
 * the site silently falls back to a native submit. Emptying the body on the
 * client leaves the import unused, and Rollup drops the whole branch.
 */
export const withRequestLogger = createServerOnlyFn(
	<T>(bindings: Record<string, string>, run: () => Promise<T>) =>
		wrapWithLogger(
			(
				loggerStorage.getStore() ?? pinoLogger.child({ reqId: randomUUID() })
			).child(bindings),
			run,
		),
);

/**
 * Chained into `errorHandlingMiddleware`, which every server function that
 * reaches a service goes through. Route handlers are not middleware, so they call
 * `withRequestLogger` themselves.
 */
export const loggerMiddleware = createMiddleware({ type: "function" }).server(
	({ next, serverFnMeta }) =>
		withRequestLogger({ serverFn: serverFnMeta.name }, next),
);
