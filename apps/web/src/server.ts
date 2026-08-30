import type { Register } from "@tanstack/react-router";
import type { RequestHandler } from "@tanstack/react-start/server";
import {
	createStartHandler,
	defaultStreamHandler,
} from "@tanstack/react-start/server";
import { observeHttpRequest } from "#/libs/server/metrics";

export type ServerEntry = { fetch: RequestHandler<Register> };

const startHandler = createStartHandler(defaultStreamHandler);

/**
 * Wire-level view of every request the Start server answers: SSR documents,
 * server function calls, route handlers and assets alike. It is the only place
 * that sees SSR render latency, and the only one that sees a request that never
 * reached a handler.
 *
 * For `/api/briefs/audio/:id` the duration is time-to-response, not the time
 * spent streaming the track: the handler returns as soon as the S3 body is
 * wired up.
 */
const fetch: ServerEntry["fetch"] = async (request, opts) => {
	const startedAt = performance.now();
	const { pathname } = new URL(request.url);

	try {
		const response = await startHandler(request, opts);

		observeHttpRequest({
			pathname,
			method: request.method,
			statusCode: response.status,
			durationMs: performance.now() - startedAt,
		});

		return response;
	} catch (error) {
		// A throw here never reached a route handler, so nothing else will record
		// it. Count it as a 500 so the error rate stays honest.
		observeHttpRequest({
			pathname,
			method: request.method,
			statusCode: 500,
			durationMs: performance.now() - startedAt,
		});

		throw error;
	}
};

export default { fetch } satisfies ServerEntry;
