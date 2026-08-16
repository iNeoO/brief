import { AUTH_PATH } from "@brief/common/constants";

export const ROUTES = {
	landing: "/",
	signIn: "/sign-in",
	signUp: "/sign-up",
	forgotPassword: "/forgot-password",
	resetPassword: AUTH_PATH.RESET_PASSWORD,
	validateEmail: AUTH_PATH.VERIFY_EMAIL,
	home: "/home",
	admin: "/admin",
	adminCategories: "/admin/categories",
	preferences: "/preferences",
	about: "/about",
	legal: "/legal",
	privacy: "/privacy",
	contact: "/contact",
} as const;
