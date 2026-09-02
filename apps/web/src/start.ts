import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { httpLoggerMiddleware } from "#/libs/server/http-logger";

/**
 * Start applies this exact middleware by itself, but only for as long as an app
 * declares no start instance — `requestMiddleware: hasStartInstance ?
 * startOptions.requestMiddleware : [defaultCsrfMiddleware]`. The moment this
 * file exists the default is gone and the check is ours to declare, so removing
 * it from the list below silently unprotects every server function. They are
 * same-origin RPC endpoints; keep it.
 */
const csrfMiddleware = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
});

/**
 * Request middleware runs for both entry paths of the Start handler — server
 * function calls and everything the router answers — and before any route's own
 * middleware.
 *
 * The logger is named first on purpose: the chain is entered in order, so it
 * wraps the CSRF check and therefore sees the 403 that check answers with. The
 * other way round, a rejected request would never be logged.
 */
export const startInstance = createStart(() => ({
	requestMiddleware: [httpLoggerMiddleware, csrfMiddleware],
}));
