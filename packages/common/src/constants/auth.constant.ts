/**
 * Front-end paths the auth emails link to. Better Auth points its links at the
 * API by default; these are the pages the user is actually sent to, so the
 * backend that builds the link and the app that serves the page have to agree
 * on them.
 */
export const AUTH_PATH = {
	VERIFY_EMAIL: "/validate-email",
	RESET_PASSWORD: "/reset-password",
} as const;
