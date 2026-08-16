import type { CATEGORY_SORT } from "../constants/categories.constant.js";

export type CategorySort = (typeof CATEGORY_SORT)[keyof typeof CATEGORY_SORT];
