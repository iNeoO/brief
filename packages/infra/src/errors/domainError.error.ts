import type { DomainErrorCode } from "@brief/common/types";

type DomainErrorOptions = {
	code: DomainErrorCode;
	message?: string;
};

export class DomainError extends Error {
	readonly code: DomainErrorCode;

	constructor({ code, message }: DomainErrorOptions) {
		super(message ?? code);
		this.name = "DomainError";
		this.code = code;

		Object.setPrototypeOf(this, DomainError.prototype);
	}
}

export const isDomainError = (error: unknown): error is DomainError =>
	error instanceof DomainError ||
	(error instanceof Error && error.name === "DomainError" && "code" in error);
