import { USER_NAME_MAX_LENGTH } from "@brief/common/constants";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	getRequestHeadersAsHeaders,
	mergeSetCookieHeadersIntoRequestHeaders,
	setResponseCookies,
} from "#/libs/server/headers";
import {
	authedMiddleware,
	containerMiddleware,
} from "#/libs/server/middleware";
import { enforceAuthRateLimit } from "#/libs/server/rate-limit";
import { attempt } from "#/libs/server/result";

const emailSchema = z.email();
const passwordSchema = z.string().min(8);

const signInInput = z.object({
	email: emailSchema,
	password: z.string().min(1),
	callbackURL: z.string().optional(),
	rememberMe: z.boolean().optional(),
});

const signUpInput = z.object({
	name: z.string().min(1),
	email: emailSchema,
	password: passwordSchema,
	callbackURL: z.string().optional(),
});

const requestPasswordResetInput = z.object({
	email: emailSchema,
	redirectTo: z.string().optional(),
});

const resetPasswordInput = z.object({
	token: z.string().min(1),
	newPassword: passwordSchema,
});

const verifyEmailInput = z.object({
	token: z.string().min(1),
	callbackURL: z.string().optional(),
});

const sendVerificationEmailInput = z.object({
	email: emailSchema,
	callbackURL: z.string().optional(),
});

const updateProfileInput = z.object({
	name: z.string().trim().min(1).max(USER_NAME_MAX_LENGTH),
});

const changePasswordInput = z.object({
	currentPassword: z.string().min(1),
	newPassword: passwordSchema,
});

export const signInWithEmailAndPassword = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(signInInput)
	.handler(({ data, context }) =>
		attempt(async () => {
			await enforceAuthRateLimit(context.container.redis, "signIn", data.email);

			const { headers } =
				await context.container.authService.signInWithEmailAndPassword({
					...data,
					headers: getRequestHeadersAsHeaders(),
				});

			setResponseCookies(headers);

			return context.container.authService.getSession({
				headers: mergeSetCookieHeadersIntoRequestHeaders(headers),
			});
		}),
	);

export const signUpWithEmailAndPassword = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(signUpInput)
	.handler(({ data, context }) =>
		attempt(async () => {
			await enforceAuthRateLimit(context.container.redis, "signUp", data.email);

			await context.container.authService.signUpWithEmailAndPassword({
				...data,
				headers: getRequestHeadersAsHeaders(),
			});

			return { success: true };
		}),
	);

export const signOut = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.handler(async ({ context }) => {
		const { headers } = await context.container.authService.signOut({
			headers: getRequestHeadersAsHeaders(),
		});

		setResponseCookies(headers);

		return { success: true };
	});

export const getSession = createServerFn({ method: "GET" })
	.middleware([containerMiddleware])
	.handler(({ context }) =>
		context.container.authService.getSession({
			headers: getRequestHeadersAsHeaders(),
		}),
	);

export type AuthSession = Awaited<ReturnType<typeof getSession>>;

export const sessionQueryKey = ["auth", "session"] as const;

export const sessionQueryOptions = () =>
	queryOptions({
		queryKey: sessionQueryKey,
		queryFn: () => getSession(),
	});

export const requestPasswordReset = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(requestPasswordResetInput)
	.handler(({ data, context }) =>
		attempt(async () => {
			await enforceAuthRateLimit(
				context.container.redis,
				"requestPasswordReset",
				data.email,
			);

			await context.container.authService.requestPasswordReset({
				...data,
				headers: getRequestHeadersAsHeaders(),
			});

			return { success: true };
		}),
	);

export const resetPassword = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(resetPasswordInput)
	.handler(({ data, context }) =>
		attempt(async () => {
			await context.container.authService.resetPassword({
				...data,
				headers: getRequestHeadersAsHeaders(),
			});

			return { success: true };
		}),
	);

export const verifyEmail = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(verifyEmailInput)
	.handler(({ data, context }) =>
		attempt(async () => {
			await context.container.authService.verifyEmail({
				...data,
				headers: getRequestHeadersAsHeaders(),
			});

			return { success: true };
		}),
	);

export const sendVerificationEmail = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(sendVerificationEmailInput)
	.handler(({ data, context }) =>
		attempt(async () => {
			await enforceAuthRateLimit(
				context.container.redis,
				"sendVerificationEmail",
				data.email,
			);

			await context.container.authService.sendVerificationEmail({
				...data,
				headers: getRequestHeadersAsHeaders(),
			});

			return { success: true };
		}),
	);

export const updateProfile = createServerFn({ method: "POST" })
	.middleware([authedMiddleware])
	.validator(updateProfileInput)
	.handler(({ data, context }) =>
		attempt(async () => {
			const { headers } = await context.container.authService.updateUser({
				name: data.name,
				headers: getRequestHeadersAsHeaders(),
			});

			setResponseCookies(headers);

			return context.container.authService.getSession({
				headers: mergeSetCookieHeadersIntoRequestHeaders(headers),
			});
		}),
	);

export const changePassword = createServerFn({ method: "POST" })
	.middleware([authedMiddleware])
	.validator(changePasswordInput)
	.handler(({ data, context }) =>
		attempt(async () => {
			await enforceAuthRateLimit(
				context.container.redis,
				"changePassword",
				context.user.email,
			);

			const { headers } = await context.container.authService.changePassword({
				...data,
				revokeOtherSessions: true,
				headers: getRequestHeadersAsHeaders(),
			});

			setResponseCookies(headers);

			return { success: true };
		}),
	);
