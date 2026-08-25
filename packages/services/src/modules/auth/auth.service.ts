import type { Database } from "@brief/drizzle";
import type { RedisClient } from "@brief/infra/redis";
import type { MailService } from "../mail/mail.service.js";
import { type AppAuth, createAuth } from "./auth.js";
import type {
	AuthConfig,
	ChangePasswordInput,
	GetSessionInput,
	RequestPasswordResetInput,
	ResetPasswordInput,
	SendVerificationEmailInput,
	SignInWithEmailAndPasswordInput,
	SignOutInput,
	SignUpWithEmailAndPasswordInput,
	UpdateUserInput,
	VerifyEmailInput,
} from "./auth.type.js";

type AuthServiceDeps = {
	db: Database;
	redis: RedisClient;
	mailService: MailService;
	config: AuthConfig;
};

export class AuthService {
	private auth: AppAuth;

	constructor({ db, redis, mailService, config }: AuthServiceDeps) {
		this.auth = createAuth({ db, redis, mailService, config });
	}

	signInWithEmailAndPassword({
		email,
		password,
		callbackURL,
		rememberMe,
		headers,
	}: SignInWithEmailAndPasswordInput) {
		return this.auth.api.signInEmail({
			body: { email, password, callbackURL, rememberMe },
			headers,
			returnHeaders: true,
		});
	}

	signUpWithEmailAndPassword({
		name,
		email,
		password,
		callbackURL,
		headers,
	}: SignUpWithEmailAndPasswordInput) {
		return this.auth.api.signUpEmail({
			body: { name, email, password, callbackURL },
			headers,
			returnHeaders: true,
		});
	}

	signOut({ headers }: SignOutInput) {
		return this.auth.api.signOut({ headers, returnHeaders: true });
	}

	getSession({ headers }: GetSessionInput) {
		return this.auth.api.getSession({ headers });
	}

	updateUser({ name, headers }: UpdateUserInput) {
		return this.auth.api.updateUser({
			body: { name },
			headers,
			returnHeaders: true,
		});
	}

	changePassword({
		currentPassword,
		newPassword,
		revokeOtherSessions,
		headers,
	}: ChangePasswordInput) {
		return this.auth.api.changePassword({
			body: { currentPassword, newPassword, revokeOtherSessions },
			headers,
			returnHeaders: true,
		});
	}

	requestPasswordReset({
		email,
		redirectTo,
		headers,
	}: RequestPasswordResetInput) {
		return this.auth.api.requestPasswordReset({
			body: { email, redirectTo },
			headers,
		});
	}

	resetPassword({ token, newPassword, headers }: ResetPasswordInput) {
		return this.auth.api.resetPassword({
			body: { token, newPassword },
			headers,
		});
	}

	verifyEmail({ token, callbackURL, headers }: VerifyEmailInput) {
		return this.auth.api.verifyEmail({
			query: { token, callbackURL },
			headers,
		});
	}

	sendVerificationEmail({
		email,
		callbackURL,
		headers,
	}: SendVerificationEmailInput) {
		return this.auth.api.sendVerificationEmail({
			body: { email, callbackURL },
			headers,
		});
	}
}
