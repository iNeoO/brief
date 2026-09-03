export class ApiError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export async function toApiError(res: Response, fallbackMessage: string): Promise<ApiError> {
	try {
		const json = (await res.json()) as { code?: string; error?: string };
		return new ApiError(json.code ?? "UNKNOWN_ERROR", json.error ?? fallbackMessage, res.status);
	} catch {
		return new ApiError("UNKNOWN_ERROR", fallbackMessage, res.status);
	}
}
