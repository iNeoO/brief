import type { USER_ROLE, USER_SORT } from "../constants/users.constant.js";

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export type UserSort = (typeof USER_SORT)[keyof typeof USER_SORT];
