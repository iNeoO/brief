import { randomUUID } from "node:crypto";
import type { PinoLogger } from "@brief/infra/libs";
import { pinoLogger, wrapWithLogger } from "@brief/infra/libs";
import { createMiddleware, createServerOnlyFn } from "@tanstack/react-start";

/**
 * Prometheus scrapes `/metrics` every few seconds, forever, and a 200 there
 * says nothing the metrics themselves do not already say. A failing scrape is
 * still logged: it is the one outcome worth a line.
 */
const QUIET_PATHNAMES = new Set(["/metrics"]);

type RequestFacts = {
	method: string;
	pathname: string;
	/** `serverFn` for an RPC call, `router` for an SSR document or a route handler. */
	handlerType: "router" | "serverFn";
};

/**
 * Every server function call arrives on this base with the operation encoded
 * into a ~100 character id, so the raw pathname is unreadable in a log panel.
 * The message says the base only and the field keeps the whole thing.
 * `normalizeRoute` in `./metrics.ts` collapses the same prefix for the `route`
 * metric label.
 */
const SERVER_FN_BASE = "/_serverFn";

const levelFor = (statusCode: number) => {
	if (statusCode >= 500) {
		return "error" as const;
	}

	return statusCode >= 400 ? ("warn" as const) : ("info" as const);
};

const emit = (
	logger: PinoLogger,
	{ method, pathname, handlerType }: RequestFacts,
	statusCode: number,
	durationMs: number,
	err?: unknown,
) => {
	if (QUIET_PATHNAMES.has(pathname) && statusCode < 400) {
		return;
	}

	// The essentials live in the message so a Grafana log panel is readable
	// without expanding a line; they are repeated as flat fields so LogQL can
	// filter on them (`| json | statusCode >= 500`).
	const route = pathname.startsWith(SERVER_FN_BASE) ? SERVER_FN_BASE : pathname;

	logger[levelFor(statusCode)](
		{
			method,
			pathname,
			statusCode,
			durationMs: Math.round(durationMs * 10) / 10,
			handlerType,
			...(err === undefined ? {} : { err }),
		},
		`${method} ${route} ${statusCode} ${Math.round(durationMs)}ms`,
	);
};

/**
 * `createServerOnlyFn` keeps `pinoLogger` out of the browser bundle, for the
 * same reason as in `./logger.ts` and just as load-bearing: `start.ts` names
 * this middleware, and the start entry is evaluated on the client too. Without
 * the wrapper `pino-pretty` ships to the browser and throws while the bundle is
 * still evaluating.
 */
const logRequest = createServerOnlyFn(
	async <TResult extends { response: Response }>(
		facts: RequestFacts,
		next: () => Promise<TResult> | TResult,
	) => {
		const startedAt = performance.now();

		// Minted here rather than downstream so one request has one id, whatever
		// it goes through: this line, the service logs of a server function, and
		// the logs of a route handler all share it. `withRequestLogger` inherits
		// this logger instead of starting its own.
		const logger = pinoLogger.child({ reqId: randomUUID() });

		try {
			const result = await wrapWithLogger(logger, async () => await next());

			emit(
				logger,
				facts,
				result.response.status,
				performance.now() - startedAt,
			);

			return result;
		} catch (error) {
			// Nothing downstream answered, so nothing downstream logged. A client
			// that navigates away mid-render lands here too, as an aborted request.
			emit(logger, facts, 500, performance.now() - startedAt, error);

			throw error;
		}
	},
);

/**
 * One line per request the Start server answers, SSR documents and server
 * function calls alike, recorded after the response is ready.
 *
 * The duration is time-to-response, not time-to-last-byte: `defaultStreamHandler`
 * returns as soon as the shell is ready, and `/api/briefs/audio/:id` as soon as
 * the S3 body is wired up. Same measurement as
 * `brief_web_http_request_duration_seconds`, which stays in `server.ts`.
 *
 * Which server function a `serverFn` line carried is deliberately not a field:
 * `serverFnMeta` is declared on the request middleware options, but
 * `@tanstack/start-server-core` 1.169.21 never fills it — the function is
 * resolved from the id further down the chain. It is one `reqId` filter away,
 * since the function's own lines share this line's id, and
 * `brief_web_server_fn_requests_total` carries it as a metric dimension.
 *
 * Registered in `src/start.ts`.
 */
export const httpLoggerMiddleware = createMiddleware({
	type: "request",
}).server(({ request, pathname, next, handlerType }) =>
	logRequest({ method: request.method, pathname, handlerType }, next),
);
