import type { DomainErrorCode } from "@brief/common/types";

type DomainErrorOptions = {
	code: DomainErrorCode;
	message?: string;
};

/**
 * An expected business-rule violation caused by the caller, not by a bug.
 * The HTTP boundary translates it into a 4xx with a user-facing message;
 * unlike `InternalError` it is never logged as a server error.
 */
export class DomainError extends Error {
	readonly code: DomainErrorCode;

	constructor({ code, message }: DomainErrorOptions) {
		super(message ?? code);
		this.name = "DomainError";
		this.code = code;

		Object.setPrototypeOf(this, DomainError.prototype);
	}
}

/**
 * Also accepts a structural match, not only `instanceof`: `apps/web` is bundled,
 * so class identity is not guaranteed to survive the server module graph, and a
 * missed match would silently degrade the response back to a generic 500.
 */
export const isDomainError = (error: unknown): error is DomainError =>
	error instanceof DomainError ||
	(error instanceof Error && error.name === "DomainError" && "code" in error);
