import type { Locale } from "../config";
import { type Dictionary, en } from "./en";
import { fr } from "./fr";

export type { Dictionary };

export const DICTIONARIES: Record<Locale, Dictionary> = { en, fr };
