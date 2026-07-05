import type { schema } from "@brief/drizzle";

export type Provider = typeof schema.providers.$inferSelect;
export type SlugConnectors = "france-info" | "Orange";
