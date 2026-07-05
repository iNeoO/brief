import type { APIError } from "@brief/common/types";
import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";

type FetchTextOptions = {
	url: string;
	context: string;
	timeoutMs?: number;
	timeoutCode?: APIError;
	fetchErrorCode?: APIError;
};

export const fetchText = async ({
	url,
	context,
	timeoutMs = 5000,
	timeoutCode = "CONNECTOR_TIMEOUT",
	fetchErrorCode = "CONNECTOR_FETCH_ERROR",
}: FetchTextOptions): Promise<string> => {
	const abortController = new AbortController();
	const timeout = setTimeout(() => abortController.abort(), timeoutMs);

	try {
		const response = await fetch(url, { signal: abortController.signal });
		if (!response.ok) {
			const logger = getLoggerStore();
			const message = `Request to ${context} failed with status ${response.status}`;
			logger.error({ status: response.status, url }, message);
			throw new InternalError({ message, code: fetchErrorCode });
		}
		return await response.text();
	} catch (err) {
		if (err instanceof InternalError) {
			throw err;
		}

		const logger = getLoggerStore();
		if (err instanceof Error && err.name === "AbortError") {
			const message = `Request to ${context} timed out (${timeoutMs}ms)`;
			logger.warn({ err }, message);
			throw new InternalError({ message, code: timeoutCode });
		}

		const message = `Request to ${context} failed`;
		logger.error({ err }, message);
		throw new InternalError({ message, code: fetchErrorCode });
	} finally {
		clearTimeout(timeout);
	}
};
