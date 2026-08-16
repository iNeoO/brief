export type AuthConfig = {
	secret: string;
	/** Public origin the browser actually uses. Cookies are scoped to it. */
	url: string;
	redisKeyPrefix: string;
};

type WithHeaders = {
	headers: Headers;
};

export type SignInWithEmailAndPasswordInput = WithHeaders & {
	email: string;
	password: string;
	callbackURL?: string;
	rememberMe?: boolean;
};

export type SignUpWithEmailAndPasswordInput = WithHeaders & {
	name: string;
	email: string;
	password: string;
	callbackURL?: string;
};

export type SignOutInput = WithHeaders;

export type GetSessionInput = WithHeaders;

export type RequestPasswordResetInput = WithHeaders & {
	email: string;
	redirectTo?: string;
};

export type ResetPasswordInput = WithHeaders & {
	token: string;
	newPassword: string;
};

export type VerifyEmailInput = WithHeaders & {
	token: string;
	callbackURL?: string;
};

export type SendVerificationEmailInput = WithHeaders & {
	email: string;
	callbackURL?: string;
};
