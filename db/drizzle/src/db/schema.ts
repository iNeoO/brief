import { defineRelations } from "drizzle-orm";
import {
	boolean,
	integer,
	pgTable,
	serial,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

export const providers = pgTable("providers", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	url: text("url").notNull(),
	isEnable: boolean("is_enabled").notNull().default(true),
	fetchLimit: integer("fetch_limit").default(5),
	lastFetchedAt: timestamp("last_fetched_at"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const articles = pgTable(
	"articles",
	{
		id: serial("id").primaryKey(),
		providerId: integer("provider_id")
			.notNull()
			.references(() => providers.id),
		url: text("url").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		content: text("content"),
		publishedAt: timestamp("published_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(t) => [unique("articles_provider_url_unique").on(t.providerId, t.url)],
);

export const relations = defineRelations({ providers, articles }, (r) => ({
	providers: {
		articles: r.many.articles(),
	},
	articles: {
		providers: r.one.providers({
			from: r.articles.providerId,
			to: r.providers.id,
		}),
	},
}));
