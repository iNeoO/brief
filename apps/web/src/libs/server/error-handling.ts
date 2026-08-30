import { isDomainError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createMiddleware } from "@tanstack/react-start";
import {
	createGenericError,
	getAPIErrorMessage,
	getAPIErrorStatus,
	getDomainErrorResponse,
	isAPIError,
	isServerError,
	ServerError,
} from "./errors";
import { loggerMiddleware } from "./logger";
import { observeServerFn } from "./metrics";

const normalizeServerError = (
	error: unknown,
	operation: string,
): ServerError => {
	if (isServerError(error)) {
		return error;
	}

	if (isDomainError(error)) {
		const response = getDomainErrorResponse(error.code);

		if (response) {
			return new ServerError(response.message, response.status);
		}
	}

	if (isAPIError(error)) {
		const status = getAPIErrorStatus(error);

		if (status < 500) {
			return new ServerError(getAPIErrorMessage(error), status);
		}
	}

	getLoggerStore().error({ err: error, operation }, "Server function failed");

	return createGenericError();
};

/**
 * The one place that knows a server function's name, its outcome and the status
 * it answers with, so it is also where the per-operation metrics are recorded.
 * The timing covers the whole downstream chain — container, auth guard, handler
 * — but not request parsing or response serialization;
 * `brief_web_http_request_duration_seconds{route="/_serverFn"}` covers the
 * wire-level view.
 */
export const errorHandlingMiddleware = createMiddleware({
	type: "function",
})
	.middleware([loggerMiddleware])
	.server(async ({ next, serverFnMeta }) => {
		const operation = serverFnMeta.name;
		const startedAt = performance.now();

		const observe = (statusCode: number, result: "success" | "error") =>
			observeServerFn({
				operation,
				statusCode,
				durationMs: performance.now() - startedAt,
				result,
			});

		try {
			const response = await next();

			observe(200, "success");

			return response;
		} catch (error) {
			// A redirect or a `notFound` is how a server function reports an outcome
			// the caller asked for, not a failure — an unverified email sent to the
			// validation page, a brief that is not published yet. Counting them as
			// errors would put a permanent floor under the error rate.
			if (isRedirect(error)) {
				observe(302, "success");
				throw error;
			}

			if (isNotFound(error)) {
				observe(404, "success");
				throw error;
			}

			const serverError = normalizeServerError(error, operation);

			observe(serverError.status, "error");

			throw serverError;
		}
	});
