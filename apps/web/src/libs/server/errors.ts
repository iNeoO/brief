import type { DomainErrorCode } from "@brief/common/types";

const GENERIC_MESSAGE = "Une erreur est survenue. Veuillez réessayer.";

export class ServerError extends Error {
	readonly status: number;

	constructor(message: string, status = 500) {
		super(message);
		this.name = "ServerError";
		this.status = status;

		Object.setPrototypeOf(this, ServerError.prototype);
	}
}

export const isServerError = (error: unknown): error is ServerError =>
	error instanceof ServerError;

export const createUnauthorizedError = () =>
	new ServerError("Vous devez être connecté.", 401);

export const createTooManyRequestsError = () =>
	new ServerError("Trop de tentatives. Réessayez dans quelques minutes.", 429);

export const createGenericError = () => new ServerError(GENERIC_MESSAGE, 500);

/**
 * Transport mapping for the domain rules services are allowed to reject on.
 * Exhaustive by construction: a new `DomainErrorCode` without an entry here is a
 * compile error, so a rule can never silently fall back to a generic 500.
 */
const DOMAIN_ERROR_RESPONSES: Record<
	DomainErrorCode,
	{ status: number; message: string }
> = {
	SUBSCRIPTION_CATEGORY_DISABLED: {
		status: 409,
		message: "Cette catégorie n'est plus disponible.",
	},
	SUBSCRIPTION_CATEGORY_NOT_FOUND: {
		status: 404,
		message: "Cette catégorie n'existe plus.",
	},
};

export const getDomainErrorResponse = (code: string) =>
	DOMAIN_ERROR_RESPONSES[code as DomainErrorCode];

type ApiErrorLike = {
	status: unknown;
	body?: { message?: unknown };
	message?: unknown;
};

export const isAPIError = (
	error: unknown,
): error is ApiErrorLike & { status: number | string } => {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const candidate = error as ApiErrorLike;

	return (
		candidate.status !== undefined &&
		(error as Error).name === "APIError" &&
		("message" in candidate || "body" in candidate)
	);
};

const STATUS_BY_NAME: Record<string, number> = {
	BAD_REQUEST: 400,
	UNAUTHORIZED: 401,
	FORBIDDEN: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	UNPROCESSABLE_ENTITY: 422,
	TOO_MANY_REQUESTS: 429,
};

export const getAPIErrorStatus = (error: ApiErrorLike) => {
	if (typeof error.status === "number") {
		return error.status;
	}

	if (typeof error.status === "string") {
		return STATUS_BY_NAME[error.status] ?? 500;
	}

	return 500;
};

export const getAPIErrorMessage = (error: ApiErrorLike) => {
	if (typeof error.body?.message === "string") {
		return error.body.message;
	}

	if (typeof error.message === "string") {
		return error.message;
	}

	return GENERIC_MESSAGE;
};
