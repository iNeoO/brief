export const getErrorStatus = (error: unknown): number | undefined => {
	if (typeof error !== "object" || error === null || !("status" in error)) {
		return undefined;
	}

	const { status } = error as { status: unknown };

	return typeof status === "number" ? status : undefined;
};

export const resolveErrorMessage = (
	error: unknown,
	byStatus: Partial<Record<number, string>>,
	fallback: string,
): string => {
	const status = getErrorStatus(error);

	if (status === undefined) {
		return fallback;
	}

	return byStatus[status] ?? fallback;
};
