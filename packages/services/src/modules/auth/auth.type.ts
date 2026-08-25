export type AuthConfig = {
	secret: string;
	url: string;
	redisKeyPrefix: string;
	adminUserIds: string[];
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

export type UpdateUserInput = WithHeaders & {
	name: string;
};

export type ChangePasswordInput = WithHeaders & {
	currentPassword: string;
	newPassword: string;
	revokeOtherSessions?: boolean;
};

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
