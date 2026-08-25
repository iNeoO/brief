import { AUTH_PATH } from "@brief/common/constants";

export const ROUTES = {
	landing: "/",
	signIn: "/sign-in",
	signUp: "/sign-up",
	forgotPassword: "/forgot-password",
	resetPassword: AUTH_PATH.RESET_PASSWORD,
	validateEmail: AUTH_PATH.VERIFY_EMAIL,
	briefs: "/briefs",
	brief: "/briefs/$id",
	home: "/home",
	profile: "/profile",
	admin: "/admin",
	adminCategories: "/admin/categories",
	topics: "/topics",
	howItWorks: "/how-it-works",
	about: "/about",
	legal: "/legal",
	privacy: "/privacy",
	contact: "/contact",
} as const;
