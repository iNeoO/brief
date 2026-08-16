import { getAPIErrorStatus, isAPIError, isServerError } from "./errors";

export type Failure = { ok: false; status: number };

export type Result<TData> = { ok: true; data: TData } | Failure;

export const attempt = async <TData>(
	run: () => Promise<TData>,
): Promise<Result<TData>> => {
	try {
		return { ok: true, data: await run() };
	} catch (error) {
		if (isServerError(error) && error.status < 500) {
			return { ok: false, status: error.status };
		}

		if (isAPIError(error)) {
			const status = getAPIErrorStatus(error);

			if (status < 500) {
				return { ok: false, status };
			}
		}

		throw error;
	}
};
