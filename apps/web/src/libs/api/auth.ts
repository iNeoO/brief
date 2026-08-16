import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	getRequestHeadersAsHeaders,
	mergeSetCookieHeadersIntoRequestHeaders,
	setResponseCookies,
} from "#/libs/server/headers";
import { containerMiddleware } from "#/libs/server/middleware";
import { enforceAuthRateLimit } from "#/libs/server/rate-limit";

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

export const signInWithEmailAndPassword = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(signInInput)
	.handler(async ({ data, context }) => {
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
	});

export const signUpWithEmailAndPassword = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(signUpInput)
	.handler(async ({ data, context }) => {
		await enforceAuthRateLimit(context.container.redis, "signUp", data.email);

		await context.container.authService.signUpWithEmailAndPassword({
			...data,
			headers: getRequestHeadersAsHeaders(),
		});

		return { success: true };
	});

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

export const sessionQueryOptions = () => ({
	queryKey: sessionQueryKey,
	queryFn: () => getSession(),
});

export const requestPasswordReset = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(requestPasswordResetInput)
	.handler(async ({ data, context }) => {
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
	});

export const resetPassword = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(resetPasswordInput)
	.handler(async ({ data, context }) => {
		await context.container.authService.resetPassword({
			...data,
			headers: getRequestHeadersAsHeaders(),
		});

		return { success: true };
	});

export const verifyEmail = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(verifyEmailInput)
	.handler(async ({ data, context }) => {
		await context.container.authService.verifyEmail({
			...data,
			headers: getRequestHeadersAsHeaders(),
		});

		return { success: true };
	});

export const sendVerificationEmail = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(sendVerificationEmailInput)
	.handler(async ({ data, context }) => {
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
	});
