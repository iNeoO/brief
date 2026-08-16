/** Codes for DomainError — expected business-rule violations, surfaced to the client as 4xx. */
export const DOMAIN_ERROR_CODE = {
	SUBSCRIPTION_CATEGORY_DISABLED: "SUBSCRIPTION_CATEGORY_DISABLED",
	SUBSCRIPTION_CATEGORY_NOT_FOUND: "SUBSCRIPTION_CATEGORY_NOT_FOUND",
} as const;
