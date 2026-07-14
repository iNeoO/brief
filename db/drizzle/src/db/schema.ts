import {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
	FILE_LANGUAGE,
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

export const categories = pgTable("categories", {
	id: uuid("id").primaryKey().default(sql`uuidv7()`),
	name: text("name").notNull(),
	description: text("description").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const providers = pgTable(
	"providers",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
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

export const categoryProviders = pgTable(
	"category_providers",
	{
		categoryId: uuid("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "cascade" }),

		providerId: uuid("provider_id")
			.notNull()
			.references(() => providers.id, { onDelete: "cascade" }),
	},
	(t) => [
		primaryKey({
			columns: [t.categoryId, t.providerId],
		}),
		index("category_providers_provider_id_idx").on(t.providerId),
	],
);

export const articles = pgTable(
	"articles",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		providerId: uuid("provider_id")
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

export const jobStatus = pgEnum("job_status", [
	JOB_STATUS.PENDING,
	JOB_STATUS.RUNNING,
	JOB_STATUS.FINISHED,
	JOB_STATUS.FAILED,
]);

export const categoryJobStatus = pgEnum("category_job_status", [
	CATEGORY_JOB_STATUS.WAITING_FOR_PROVIDERS,
	CATEGORY_JOB_STATUS.PENDING,
	CATEGORY_JOB_STATUS.RUNNING,
	CATEGORY_JOB_STATUS.FINISHED,
	CATEGORY_JOB_STATUS.FAILED,
]);

export const categoryJobState = pgEnum("category_job_state", [
	CATEGORY_JOB_STATE.CREATING_REPORT,
	CATEGORY_JOB_STATE.CREATING_AUDIO,
	CATEGORY_JOB_STATE.SENDING_MESSAGE,
]);

export const categoryJobs = pgTable(
	"category_jobs",
	{
		id: serial("id").primaryKey(),
		categoryId: uuid("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "restrict" }),
		targetDate: date("target_date", { mode: "date" }).notNull(),
		status: categoryJobStatus("status").notNull(),
		state: categoryJobState("state")
			.notNull()
			.default(CATEGORY_JOB_STATE.CREATING_REPORT),
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
		unique("category_jobs_category_target_date_unique").on(
			t.categoryId,
			t.targetDate,
		),
		index("category_jobs_status_created_at_idx").on(t.status, t.createdAt),
		index("category_jobs_pending_queue_idx")
			.on(t.createdAt)
			.where(sql`${t.status} = 'pending'`),
		check(
			"category_jobs_finished_at_consistency",
			sql`(${t.status} IN ('finished', 'failed')) = (${t.finishedAt} IS NOT NULL)`,
		),
		check(
			"category_jobs_failed_requires_error",
			sql`${t.status} <> 'failed' OR ${t.error} IS NOT NULL`,
		),
	],
);

export const providerFetchJobs = pgTable(
	"provider_fetch_jobs",
	{
		id: serial("id").primaryKey(),
		providerId: uuid("provider_id")
			.notNull()
			.references(() => providers.id, { onDelete: "restrict" }),
		targetDate: date("target_date", { mode: "date" }).notNull(),
		status: jobStatus("status").notNull(),
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
		unique("provider_fetch_jobs_provider_target_date_unique").on(
			t.providerId,
			t.targetDate,
		),
		index("provider_fetch_jobs_status_created_at_idx").on(
			t.status,
			t.createdAt,
		),
		index("provider_fetch_jobs_pending_queue_idx")
			.on(t.createdAt)
			.where(sql`${t.status} = 'pending'`),
		check(
			"provider_fetch_jobs_finished_at_consistency",
			sql`(${t.status} IN ('finished', 'failed')) = (${t.finishedAt} IS NOT NULL)`,
		),
		check(
			"provider_fetch_jobs_failed_requires_error",
			sql`${t.status} <> 'failed' OR ${t.error} IS NOT NULL`,
		),
	],
);

export const providerFetchJobEvents = pgTable(
	"provider_fetch_job_events",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		providerFetchJobId: integer("provider_fetch_job_id")
			.notNull()
			.references(() => providerFetchJobs.id, { onDelete: "cascade" }),
		attempt: integer("attempt").notNull(),
		status: jobStatus("status").notNull(),
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("provider_fetch_job_events_id_created_at_idx").on(
			t.providerFetchJobId,
			t.createdAt,
		),
	],
);

export const categoryJobProviderFetchJobs = pgTable(
	"category_job_provider_fetch_jobs",
	{
		categoryJobId: integer("category_job_id")
			.notNull()
			.references(() => categoryJobs.id, { onDelete: "cascade" }),
		providerFetchJobId: integer("provider_fetch_job_id")
			.notNull()
			.references(() => providerFetchJobs.id, { onDelete: "restrict" }),
	},
	(t) => [
		primaryKey({ columns: [t.categoryJobId, t.providerFetchJobId] }),
		index("category_job_provider_fetch_jobs_provider_job_idx").on(
			t.providerFetchJobId,
		),
	],
);

export const providerFetchJobArticles = pgTable(
	"provider_fetch_job_articles",
	{
		providerFetchJobId: integer("provider_fetch_job_id")
			.notNull()
			.references(() => providerFetchJobs.id, { onDelete: "cascade" }),
		articleId: uuid("article_id")
			.notNull()
			.references(() => articles.id, { onDelete: "restrict" }),
	},
	(t) => [
		primaryKey({ columns: [t.providerFetchJobId, t.articleId] }),
		index("provider_fetch_job_articles_article_id_idx").on(t.articleId),
	],
);

export const categoryJobArticles = pgTable(
	"category_job_articles",
	{
		categoryJobId: integer("category_job_id")
			.notNull()
			.references(() => categoryJobs.id, { onDelete: "cascade" }),
		articleId: uuid("article_id")
			.notNull()
			.references(() => articles.id, { onDelete: "restrict" }),
		rank: integer("rank").notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.categoryJobId, t.articleId] }),
		unique("category_job_articles_job_rank_unique").on(t.categoryJobId, t.rank),
		index("category_job_articles_article_id_idx").on(t.articleId),
		check("category_job_articles_rank_non_negative", sql`${t.rank} >= 0`),
	],
);

export const categoryJobEvents = pgTable(
	"category_job_events",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		categoryJobId: integer("category_job_id")
			.notNull()
			.references(() => categoryJobs.id, { onDelete: "cascade" }),
		attempt: integer("attempt").notNull(),
		state: categoryJobState("state").notNull(),
		status: jobStatus("status").notNull(),
		error: text("error"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index("category_job_events_category_job_id_created_at_idx").on(
			t.categoryJobId,
			t.createdAt,
		),
	],
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
		categoryJobId: integer("category_job_id")
			.notNull()
			.references(() => categoryJobs.id, { onDelete: "cascade" }),
		kind: fileKind("kind").notNull(),
		language: fileLanguage("language").notNull(),
		bucket: text("bucket").notNull(),
		objectKey: text("object_key").notNull(),
		mimeType: text("mime_type").notNull(),
		size: bigint("size", { mode: "number" }).notNull(),
		filename: text("filename").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [
		unique("files_category_job_kind_language_unique").on(
			t.categoryJobId,
			t.kind,
			t.language,
		),
	],
);

export const relations = defineRelations(
	{
		categories,
		providers,
		categoryProviders,
		articles,
		categoryJobs,
		providerFetchJobs,
		providerFetchJobEvents,
		categoryJobProviderFetchJobs,
		providerFetchJobArticles,
		categoryJobArticles,
		categoryJobEvents,
		files,
	},
	(r) => ({
		categories: {
			providers: r.many.providers({
				from: r.categories.id.through(r.categoryProviders.categoryId),
				to: r.providers.id.through(r.categoryProviders.providerId),
			}),
			jobs: r.many.categoryJobs(),
		},

		providers: {
			categories: r.many.categories({
				from: r.providers.id.through(r.categoryProviders.providerId),
				to: r.categories.id.through(r.categoryProviders.categoryId),
			}),
			articles: r.many.articles(),
			fetchJobs: r.many.providerFetchJobs(),
		},

		articles: {
			provider: r.one.providers({
				from: r.articles.providerId,
				to: r.providers.id,
			}),
			fetchJobs: r.many.providerFetchJobs({
				from: r.articles.id.through(r.providerFetchJobArticles.articleId),
				to: r.providerFetchJobs.id.through(
					r.providerFetchJobArticles.providerFetchJobId,
				),
			}),
			categoryJobs: r.many.categoryJobs({
				from: r.articles.id.through(r.categoryJobArticles.articleId),
				to: r.categoryJobs.id.through(r.categoryJobArticles.categoryJobId),
			}),
		},

		categoryJobs: {
			category: r.one.categories({
				from: r.categoryJobs.categoryId,
				to: r.categories.id,
			}),
			providerFetchJobs: r.many.providerFetchJobs({
				from: r.categoryJobs.id.through(
					r.categoryJobProviderFetchJobs.categoryJobId,
				),
				to: r.providerFetchJobs.id.through(
					r.categoryJobProviderFetchJobs.providerFetchJobId,
				),
			}),
			articles: r.many.articles({
				from: r.categoryJobs.id.through(r.categoryJobArticles.categoryJobId),
				to: r.articles.id.through(r.categoryJobArticles.articleId),
			}),
			events: r.many.categoryJobEvents(),
			files: r.many.files(),
		},

		providerFetchJobs: {
			provider: r.one.providers({
				from: r.providerFetchJobs.providerId,
				to: r.providers.id,
			}),
			categoryJobs: r.many.categoryJobs({
				from: r.providerFetchJobs.id.through(
					r.categoryJobProviderFetchJobs.providerFetchJobId,
				),
				to: r.categoryJobs.id.through(
					r.categoryJobProviderFetchJobs.categoryJobId,
				),
			}),
			articles: r.many.articles({
				from: r.providerFetchJobs.id.through(
					r.providerFetchJobArticles.providerFetchJobId,
				),
				to: r.articles.id.through(r.providerFetchJobArticles.articleId),
			}),
			events: r.many.providerFetchJobEvents(),
		},

		providerFetchJobEvents: {
			job: r.one.providerFetchJobs({
				from: r.providerFetchJobEvents.providerFetchJobId,
				to: r.providerFetchJobs.id,
			}),
		},

		categoryJobEvents: {
			job: r.one.categoryJobs({
				from: r.categoryJobEvents.categoryJobId,
				to: r.categoryJobs.id,
			}),
		},

		files: {
			job: r.one.categoryJobs({
				from: r.files.categoryJobId,
				to: r.categoryJobs.id,
			}),
		},
	}),
);
