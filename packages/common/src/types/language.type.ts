import type { LANGUAGE } from "../constants/language.constant.js";

export type Language = (typeof LANGUAGE)[keyof typeof LANGUAGE];
