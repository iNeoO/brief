import {
	FILE_LANGUAGE,
	JOB_STATE,
	JOB_STATUS,
} from "@brief/common/constants";
import { defineRelations, sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	date,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	serial,
	text,
	timestamp,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

export const providers = pgTable(
	"providers",
	{
		id: serial("id").primaryKey(),
		name: text("name").notNull(),
		slug: text("slug").notNull().unique(),
		url: text("url").notNull(),
		isEnabled: boolean("is_enabled").notNull().default(true),
		fetchLimit: integer("fetch_limit").default(5),
		lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [check("providers_fetch_limit_positive", sql`${t.fetchLimit} > 0`)],
);

export const articles = pgTable(
	"articles",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		providerId: integer("provider_id")
			.notNull()
			.references(() => providers.id, { onDelete: "restrict" }),
		url: text("url").notNull(),
		title: text("title").notNull(),
		description: text("description"),
		content: text("content"),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [
		unique("articles_provider_url_unique").on(t.providerId, t.url),
		index("articles_published_at_idx").on(t.publishedAt),
		index("articles_provider_id_published_at_idx").on(
			t.providerId,
			t.publishedAt,
		),
	],
);

export const categories = pgTable("categories", {
	id: serial("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	isEnabled: boolean("is_enabled").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const categoryProviders = pgTable(
	"category_providers",
	{
		categoryId: integer("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "cascade" }),
		providerId: integer("provider_id")
			.notNull()
			.references(() => providers.id, { onDelete: "cascade" }),
		weight: integer("weight").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [
		primaryKey({ columns: [t.categoryId, t.providerId] }),
		index("category_providers_provider_id_idx").on(t.providerId),
		check("category_providers_weight_positive", sql`${t.weight} > 0`),
	],
);

export const jobStatus = pgEnum("job_status", [
	JOB_STATUS.PENDING,
	JOB_STATUS.RUNNING,
	JOB_STATUS.FINISHED,
	JOB_STATUS.FAILED,
]);

export const jobState = pgEnum("job_state", [
	JOB_STATE.GETTING_ARTICLES,
	JOB_STATE.CREATING_REPORT,
	JOB_STATE.CREATING_AUDIO,
	JOB_STATE.SENDING_MESSAGE,
]);

export const jobs = pgTable(
	"jobs",
	{
		id: serial("id").primaryKey(),
		categoryId: integer("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "restrict" }),
		targetDate: date("target_date").notNull(),
		status: jobStatus("status").notNull(),
		state: jobState("state").notNull(),
		summary: text("summary"),
		error: text("error"),
		retry: integer("retry").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
		finishedAt: timestamp("finished_at", { withTimezone: true }),
	},
	(t) => [
		unique("jobs_category_target_date_unique").on(t.categoryId, t.targetDate),
		index("jobs_status_created_at_idx").on(t.status, t.createdAt),
		index("jobs_pending_queue_idx")
			.on(t.createdAt)
			.where(sql`${t.status} = 'pending'`),
		check(
			"jobs_finished_at_consistency",
			sql`(${t.status} IN ('finished', 'failed')) = (${t.finishedAt} IS NOT NULL)`,
		),
		check(
			"jobs_failed_requires_error",
			sql`${t.status} <> 'failed' OR ${t.error} IS NOT NULL`,
		),
	],
);

export const jobArticles = pgTable(
	"job_articles",
	{
		jobId: integer("job_id")
			.notNull()
			.references(() => jobs.id, { onDelete: "cascade" }),
		articleId: uuid("article_id")
			.notNull()
			.references(() => articles.id, { onDelete: "restrict" }),
		rank: integer("rank"),
	},
	(t) => [
		primaryKey({ columns: [t.jobId, t.articleId] }),
		index("job_articles_article_id_idx").on(t.articleId),
	],
);

export const jobEvents = pgTable(
	"job_events",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		jobId: integer("job_id")
			.notNull()
			.references(() => jobs.id, { onDelete: "cascade" }),
		attempt: integer("attempt").notNull(),
		fromState: jobState("from_state"),
		toState: jobState("to_state").notNull(),
		status: jobStatus("status").notNull(),
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [index("job_events_job_id_created_at_idx").on(t.jobId, t.createdAt)],
);

export const fileKind = pgEnum("file_kind", ["audio_file"]);

export const fileLanguage = pgEnum("file_language", [
	FILE_LANGUAGE.FR,
	FILE_LANGUAGE.EN,
]);

export const files = pgTable(
	"files",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		jobId: integer("job_id")
			.notNull()
			.references(() => jobs.id, { onDelete: "cascade" }),
		kind: fileKind("kind").notNull(),
		language: fileLanguage("language").notNull(),
		bucket: text("bucket").notNull(),
		objectKey: text("object_key").notNull(),
		mimeType: text("mime_type").notNull(),
		size: bigint("size", { mode: "number" }).notNull(),
		filename: text("filename").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [
		unique("files_job_kind_language_unique").on(t.jobId, t.kind, t.language),
	],
);

export const relations = defineRelations(
	{
		providers,
		articles,
		categories,
		categoryProviders,
		jobs,
		files,
		jobArticles,
		jobEvents,
	},
	(r) => ({
		providers: {
			articles: r.many.articles(),
			categories: r.many.categories({
				from: r.providers.id.through(r.categoryProviders.providerId),
				to: r.categories.id.through(r.categoryProviders.categoryId),
			}),
		},
		articles: {
			providers: r.one.providers({
				from: r.articles.providerId,
				to: r.providers.id,
			}),
		},
		categories: {
			providers: r.many.providers({
				from: r.categories.id.through(r.categoryProviders.categoryId),
				to: r.providers.id.through(r.categoryProviders.providerId),
			}),
			jobs: r.many.jobs(),
		},
		jobs: {
			category: r.one.categories({
				from: r.jobs.categoryId,
				to: r.categories.id,
			}),
			articles: r.many.articles({
				from: r.jobs.id.through(r.jobArticles.jobId),
				to: r.articles.id.through(r.jobArticles.articleId),
			}),
			files: r.many.files(),
			events: r.many.jobEvents(),
		},
		files: {
			job: r.one.jobs({
				from: r.files.jobId,
				to: r.jobs.id,
			}),
		},
		jobEvents: {
			job: r.one.jobs({
				from: r.jobEvents.jobId,
				to: r.jobs.id,
			}),
		},
	}),
);
