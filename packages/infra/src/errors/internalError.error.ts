import type { InternalErrorCode } from "@brief/common/types";

type InternalErrorOptions = {
	code: InternalErrorCode;
	message?: string;
};

export class InternalError extends Error {
	readonly code: InternalErrorCode;

	constructor({ code, message }: InternalErrorOptions) {
		super(message ?? code);
		this.name = "InternalError";
		this.code = code;

		Object.setPrototypeOf(this, InternalError.prototype);
	}
}
