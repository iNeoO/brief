import type { Failure, Result } from "#/libs/server/result";

export const unwrap = <TData>(result: Result<TData>): TData => {
	if (!result.ok) {
		throw result satisfies Failure;
	}

	return result.data;
};
