import type { DOMAIN_ERROR_CODE } from "../constants/domainErrorCode.constant.js";

export type DomainErrorCode = keyof typeof DOMAIN_ERROR_CODE;
