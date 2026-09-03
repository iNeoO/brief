import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service.js";

const api = {
	signInEmail: vi.fn(),
	signUpEmail: vi.fn(),
	signOut: vi.fn(),
	getSession: vi.fn(),
	updateUser: vi.fn(),
	changePassword: vi.fn(),
	requestPasswordReset: vi.fn(),
	resetPassword: vi.fn(),
	verifyEmail: vi.fn(),
	sendVerificationEmail: vi.fn(),
};

/**
 * `createAuth` builds a real better-auth instance, adapters and plugins
 * included. What this service adds is the shape of each call, so the instance
 * is replaced by the spies and better-auth itself is left to its own tests.
 */
vi.mock("./auth.js", () => ({
	createAuth: (deps: unknown) => createAuth(deps),
}));

const createAuth = vi.fn((_deps: unknown) => ({ api }));

const headers = new Headers({ cookie: "session=abc" });

const service = () =>
	new AuthService({
		db: {} as never,
		redis: {} as never,
		mailService: {} as never,
		config: {
			secret: "secret",
			url: "https://dailybriefs.fr",
			redisKeyPrefix: "brief:auth:",
			adminUserIds: ["user-1"],
		},
	});

beforeEach(() => {
	vi.clearAllMocks();
	createAuth.mockReturnValue({ api });
});

describe("the auth instance", () => {
	it("is built once, with the dependencies the service was given", () => {
		service();

		expect(createAuth).toHaveBeenCalledOnce();
		expect(createAuth).toHaveBeenCalledWith(
			expect.objectContaining({
				config: expect.objectContaining({ url: "https://dailybriefs.fr" }),
			}),
		);
	});
});

describe("the calls that hand back a session cookie", () => {
	// Every one of these writes a cookie, and the caller has to forward it: a
	// missing `returnHeaders` would sign the user in without a session.
	it("asks for the headers when signing in", () => {
		service().signInWithEmailAndPassword({
			email: "reader@example.test",
			password: "hunter2",
			callbackURL: "/topics",
			rememberMe: true,
			headers,
		});

		expect(api.signInEmail).toHaveBeenCalledWith({
			body: {
				email: "reader@example.test",
				password: "hunter2",
				callbackURL: "/topics",
				rememberMe: true,
			},
			headers,
			returnHeaders: true,
		});
	});

	it("asks for the headers when signing up", () => {
		service().signUpWithEmailAndPassword({
			name: "Valere",
			email: "reader@example.test",
			password: "hunter2",
			headers,
		});

		expect(api.signUpEmail).toHaveBeenCalledWith({
			body: {
				name: "Valere",
				email: "reader@example.test",
				password: "hunter2",
				callbackURL: undefined,
			},
			headers,
			returnHeaders: true,
		});
	});

	it("asks for the headers when signing out", () => {
		service().signOut({ headers });

		expect(api.signOut).toHaveBeenCalledWith({
			headers,
			returnHeaders: true,
		});
	});

	it("asks for the headers when the account changes", () => {
		service().updateUser({ name: "Valère", headers });

		expect(api.updateUser).toHaveBeenCalledWith({
			body: { name: "Valère" },
			headers,
			returnHeaders: true,
		});
	});

	it("asks for the headers when the password changes", () => {
		// Revoking the other sessions reissues this one, so the new cookie has to
		// come back or the user signs themselves out.
		service().changePassword({
			currentPassword: "hunter2",
			newPassword: "hunter3",
			revokeOtherSessions: true,
			headers,
		});

		expect(api.changePassword).toHaveBeenCalledWith({
			body: {
				currentPassword: "hunter2",
				newPassword: "hunter3",
				revokeOtherSessions: true,
			},
			headers,
			returnHeaders: true,
		});
	});
});

describe("the calls that only read or trigger a mail", () => {
	it("reads the session from the request headers alone", () => {
		service().getSession({ headers });

		expect(api.getSession).toHaveBeenCalledWith({ headers });
	});

	it("asks for a reset mail without touching the session", () => {
		service().requestPasswordReset({
			email: "reader@example.test",
			redirectTo: "/reset",
			headers,
		});

		expect(api.requestPasswordReset).toHaveBeenCalledWith({
			body: { email: "reader@example.test", redirectTo: "/reset" },
			headers,
		});
	});

	it("resets the password with the token from the mail", () => {
		service().resetPassword({
			token: "reset-token",
			newPassword: "hunter3",
			headers,
		});

		expect(api.resetPassword).toHaveBeenCalledWith({
			body: { token: "reset-token", newPassword: "hunter3" },
			headers,
		});
	});

	it("verifies an email through the query, not the body", () => {
		// The link in the mail is a GET: the token arrives in the URL.
		service().verifyEmail({
			token: "verify-token",
			callbackURL: "/welcome",
			headers,
		});

		expect(api.verifyEmail).toHaveBeenCalledWith({
			query: { token: "verify-token", callbackURL: "/welcome" },
			headers,
		});
	});

	it("asks for another verification mail", () => {
		service().sendVerificationEmail({
			email: "reader@example.test",
			headers,
		});

		expect(api.sendVerificationEmail).toHaveBeenCalledWith({
			body: { email: "reader@example.test", callbackURL: undefined },
			headers,
		});
	});
});
