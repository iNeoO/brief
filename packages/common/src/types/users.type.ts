import type { USER_ROLE } from "../constants/users.constant.js";

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];
