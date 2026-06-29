import type { APIError } from "@brief/common/types";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ResolverReturnType } from "hono-openapi";
import { resolver } from "hono-openapi";
import {
	ErrorSchema,
	ZodSafeParseErrorSchema,
} from "../schemas/apiErrors.schema.js";

type ApiErrorPayload = {
	code: APIError;
	error: string;
};

type ApiErrorDefinition = {
	status: ContentfulStatusCode;
	payload: ApiErrorPayload;
};

export type ApiErrorKey =
	| "AUTH_EMAIL_ALREADY_EXISTS"
	| "AUTH_INVALID_CREDENTIALS"
	| "AUTH_EMAIL_NOT_VERIFIED"
	| "AUTH_INVALID_TOKEN"
	| "AUTH_INVALID_SESSION"
	| "AUTH_SESSION_EXPIRED"
	| "AUTH_USER_NOT_FOUND"
	| "USER_NOT_FOUND"
	| "POST_NOT_FOUND"
	| "EMAIL_ALREADY_EXISTS";

export const API_ERRORS = {
	AUTH_EMAIL_ALREADY_EXISTS: {
		status: 409,
		payload: {
			code: "EMAIL_ALREADY_EXISTS",
			error: "Email already in use",
		},
	},
	AUTH_INVALID_CREDENTIALS: {
		status: 401,
		payload: {
			code: "INVALID_CREDENTIALS",
			error: "Invalid Credential",
		},
	},
	AUTH_EMAIL_NOT_VERIFIED: {
		status: 403,
		payload: {
			code: "EMAIL_NOT_VERIFIED",
			error: "Email not verified",
		},
	},
	AUTH_INVALID_TOKEN: {
		status: 400,
		payload: {
			code: "INVALID_TOKEN",
			error: "Invalid or expired token",
		},
	},
	AUTH_INVALID_SESSION: {
		status: 401,
		payload: {
			code: "INVALID_SESSION",
			error: "Unauthorized",
		},
	},
	AUTH_SESSION_EXPIRED: {
		status: 401,
		payload: {
			code: "SESSION_EXPIRED",
			error: "Unauthorized",
		},
	},
	AUTH_USER_NOT_FOUND: {
		status: 401,
		payload: {
			code: "USER_NOT_FOUND",
			error: "Unauthorized",
		},
	},
	USER_NOT_FOUND: {
		status: 404,
		payload: {
			code: "USER_NOT_FOUND",
			error: "User not found",
		},
	},
	POST_NOT_FOUND: {
		status: 404,
		payload: {
			code: "POST_NOT_FOUND",
			error: "Post not found",
		},
	},
	EMAIL_ALREADY_EXISTS: {
		status: 409,
		payload: {
			code: "EMAIL_ALREADY_EXISTS",
			error: "Email already in use",
		},
	},
} as const satisfies Record<ApiErrorKey, ApiErrorDefinition>;

export const apiError = (c: Context, key: ApiErrorKey) => {
	const { payload, status } = API_ERRORS[key];
	return c.json(payload, status);
};

export const apiErrorResolver = (): ResolverReturnType => resolver(ErrorSchema);
export const apiZodErrorResolver = (): ResolverReturnType =>
	resolver(ZodSafeParseErrorSchema);

export const openApi401Unauthorized = (description: string) => ({
	401: {
		description,
		content: {
			"application/json": { schema: apiErrorResolver() },
		},
	},
});

export const openApi400BadRequest = (description: string) => ({
	400: {
		description,
		content: {
			"application/json": { schema: apiErrorResolver() },
		},
	},
});

export const openApi400ZodError = (description: string) => ({
	400: {
		description,
		content: {
			"application/json": { schema: apiZodErrorResolver() },
		},
	},
});

export const openApi503Error = (description: string) => ({
	503: {
		description,
		content: {
			"application/json": { schema: apiErrorResolver() },
		},
	},
});

export const openApi403Forbidden = (description: string) => ({
	403: {
		description,
		content: {
			"application/json": { schema: apiErrorResolver() },
		},
	},
});
export const openApi404NotFound = (description: string) => ({
	404: {
		description,
		content: {
			"application/json": { schema: apiErrorResolver() },
		},
	},
});

export const openApi409Conflict = (description: string) => ({
	409: {
		description,
		content: {
			"application/json": { schema: apiErrorResolver() },
		},
	},
});
