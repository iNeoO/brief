import type { APIError } from "@brief/common/types";

type InternalErrorOptions = {
	code: APIError;
	message?: string;
};

export class InternalError extends Error {
	readonly code: APIError;

	constructor({ code, message }: InternalErrorOptions) {
		super(message ?? code);
		this.name = "InternalError";
		this.code = code;

		Object.setPrototypeOf(this, InternalError.prototype);
	}
}
