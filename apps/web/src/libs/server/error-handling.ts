import { isDomainError } from "@brief/infra/errors";
import { pinoLogger } from "@brief/infra/libs";
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

	pinoLogger.error({ err: error, operation }, "Server function failed");

	return createGenericError();
};

export const errorHandlingMiddleware = createMiddleware({
	type: "function",
}).server(async ({ next, serverFnMeta }) => {
	try {
		return await next();
	} catch (error) {
		if (isRedirect(error) || isNotFound(error)) {
			throw error;
		}

		throw normalizeServerError(error, serverFnMeta.name);
	}
});
