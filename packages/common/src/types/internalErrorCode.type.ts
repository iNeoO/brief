import type { INTERNAL_ERROR_CODE } from "../constants/internalErrorCode.constant.js";

export type InternalErrorCode = keyof typeof INTERNAL_ERROR_CODE;
