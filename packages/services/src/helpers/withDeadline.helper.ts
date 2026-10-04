import type { InternalErrorCode } from "@brief/common/types";
import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";

type WithDeadlineOptions<T> = {
	context: string;
	timeoutMs: number;
	timeoutCode: InternalErrorCode;
	run: (abortController: AbortController) => Promise<T>;
};

/**
 * Runs `run` under a wall-clock deadline and turns a hit deadline into an
 * `InternalError` the callers' retry bookkeeping understands.
 *
 * The OpenAI SDK already carries a ten-minute request timeout, but it clears its
 * own timer as soon as the response headers arrive, and every call we make is a
 * streamed response. A body that stops mid-stream is therefore bounded by
 * nothing we control: the promise never settles, the job stays `running`, and
 * the message keeps its consumer slot instead of failing and being retried.
 *
 * The abort itself surfaces as whatever the library makes of a cancelled run —
 * for `chat()`, a missing structured output — so the reason is restated here.
 * Without that, a deadline reads in the logs as a model that returned nothing.
 */
export const withDeadline = async <T>({
	context,
	timeoutMs,
	timeoutCode,
	run,
}: WithDeadlineOptions<T>): Promise<T> => {
	const abortController = new AbortController();
	const timeout = setTimeout(() => abortController.abort(), timeoutMs);

	try {
		return await run(abortController);
	} catch (err) {
		if (!abortController.signal.aborted) throw err;

		const message = `${context} passed its ${timeoutMs}ms deadline`;
		getLoggerStore().warn({ err }, message);
		throw new InternalError({ message, code: timeoutCode });
	} finally {
		clearTimeout(timeout);
	}
};
