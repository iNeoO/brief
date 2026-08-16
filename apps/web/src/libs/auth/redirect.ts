import { ROUTES } from "#/config/routes";

export const safeRedirectPath = (
	value: unknown,
	fallback: string = ROUTES.home,
): string => {
	if (typeof value !== "string" || value.length === 0) {
		return fallback;
	}

	if (
		!value.startsWith("/") ||
		value.startsWith("//") ||
		value.includes("\\")
	) {
		return fallback;
	}

	return value;
};
