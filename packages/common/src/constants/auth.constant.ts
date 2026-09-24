export const AUTH_PATH = {
	VERIFY_EMAIL: "/validate-email",
	RESET_PASSWORD: "/reset-password",
} as const;

/**
 * Whether a reader can open an account themselves.
 *
 * A plain constant rather than an environment variable because both sides need
 * it: the server passes it to Better Auth, and the pages that would otherwise
 * offer the form read it too. `apps/web`'s env schema is deliberately kept out
 * of the client bundle, so a variable would have to be declared twice.
 */
export const SIGNUP_ENABLED = true;
