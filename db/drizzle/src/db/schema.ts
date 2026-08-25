import {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
	CONNECTOR_KIND,
	DEFAULT_LANGUAGE,
	DEFAULT_USER_ROLE,
	FILE_KIND,
	JOB_STATUS,
	LANGUAGE,
	USER_ROLE,
	WHATSAPP_PAIRING_STATUS,
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

export const language = pgEnum("language", [LANGUAGE.FR, LANGUAGE.EN]);

export const categories = pgTable("categories", {
	id: uuid("id").primaryKey().default(sql`uuidv7()`),
	name: text("name").notNull(),
	description: text("description").notNull(),
	// Language every brief of this category is written and voiced in.
	language: language("language").notNull().default(DEFAULT_LANGUAGE),
	isEnabled: boolean("is_enabled").notNull().default(true),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const connectorKind = pgEnum("connector_kind", [
	CONNECTOR_KIND.RSS,
	CONNECTOR_KIND.ATOM,
]);

export const providers = pgTable(
	"providers",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		name: text("name").notNull(),
		slug: text("slug").notNull().unique(),
		url: text("url").notNull(),
		kind: connectorKind("kind").notNull().default(CONNECTOR_KIND.RSS),
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
		content: text("content").notNull(),
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
			// Cascade, so an admin can delete a category outright. Everything that
			// hangs below a category job — selected articles, events, message jobs
			// and audio file rows — already cascades from here. The S3 objects
			// behind those file rows are purged by the caller, after the commit.
			.references(() => categories.id, { onDelete: "cascade" }),
		targetDate: date("target_date", { mode: "date" }).notNull(),
		status: categoryJobStatus("status").notNull(),
		state: categoryJobState("state")
			.notNull()
			.default(CATEGORY_JOB_STATE.CREATING_REPORT),
		summary: text("summary"),
		sources: text("sources"),
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

export const messageJobs = pgTable(
	"message_jobs",
	{
		id: serial("id").primaryKey(),
		categoryJobId: integer("category_job_id")
			.notNull()
			.unique()
			.references(() => categoryJobs.id, { onDelete: "cascade" }),
		status: jobStatus("status").notNull(),
		error: text("error"),
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
		index("message_jobs_status_created_at_idx").on(t.status, t.createdAt),
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

export const fileKind = pgEnum("file_kind", [FILE_KIND.AUDIO_FILE]);

export const files = pgTable(
	"files",
	{
		id: uuid("id").primaryKey().default(sql`uuidv7()`),
		categoryJobId: integer("category_job_id")
			.notNull()
			.references(() => categoryJobs.id, { onDelete: "cascade" }),
		kind: fileKind("kind").notNull(),
		language: language("language").notNull(),
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

export const userRole = pgEnum("user_role", [USER_ROLE.USER, USER_ROLE.ADMIN]);

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	role: userRole("role").notNull().default(DEFAULT_USER_ROLE),
	banned: boolean("banned").notNull().default(false),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		idToken: text("id_token"),
		password: text("password"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const subscriptions = pgTable(
	"subscriptions",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),

		categoryId: uuid("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "cascade" }),

		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		primaryKey({
			columns: [t.userId, t.categoryId],
		}),
		index("subscriptions_category_id_idx").on(t.categoryId),
	],
);

export const whatsappPairingStatus = pgEnum("whatsapp_pairing_status", [
	WHATSAPP_PAIRING_STATUS.VERIFIED,
	WHATSAPP_PAIRING_STATUS.OPTED_OUT,
]);

/**
 * One row per user who has authorised us to write to them on WhatsApp. A user
 * with no row here has not paired: the waiting state is the pairing code sitting
 * in Redis, not a row.
 *
 * The three `optIn*` columns are the evidence Meta can ask for. `optInText` is
 * what the user actually sent, not the sentence we prefilled — the `wa.me`
 * prefill is editable, so only what arrived is proof.
 *
 * `phoneNumber` is unique: one WhatsApp number belongs to one account. A number
 * that pairs again from another account is transferred rather than refused, since
 * sending the message proves present control of it — see `WhatsAppPairingService`.
 */
export const whatsappPairings = pgTable(
	"whatsapp_pairings",
	{
		userId: text("user_id")
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		// E.164 without the leading `+`, verbatim from the inbound `from` field.
		// The user never types it, so there is nothing to normalise.
		phoneNumber: text("phone_number").notNull(),
		status: whatsappPairingStatus("status").notNull(),
		optInAt: timestamp("opt_in_at", { withTimezone: true }).notNull(),
		optInMessageId: text("opt_in_message_id").notNull(),
		optInText: text("opt_in_text").notNull(),
		optedOutAt: timestamp("opted_out_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(t) => [
		unique("whatsapp_pairings_phone_number_unique").on(t.phoneNumber),
		check(
			"whatsapp_pairings_opted_out_at_matches_status",
			sql`(${t.status} = ${WHATSAPP_PAIRING_STATUS.OPTED_OUT}) = (${t.optedOutAt} IS NOT NULL)`,
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
		messageJobs,
		user,
		account,
		verification,
		subscriptions,
		whatsappPairings,
	},
	(r) => ({
		categories: {
			providers: r.many.providers({
				from: r.categories.id.through(r.categoryProviders.categoryId),
				to: r.providers.id.through(r.categoryProviders.providerId),
			}),
			jobs: r.many.categoryJobs(),
			subscriptions: r.many.subscriptions(),
			subscribers: r.many.user({
				from: r.categories.id.through(r.subscriptions.categoryId),
				to: r.user.id.through(r.subscriptions.userId),
			}),
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
			messageJob: r.one.messageJobs(),
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

		messageJobs: {
			job: r.one.categoryJobs({
				from: r.messageJobs.categoryJobId,
				to: r.categoryJobs.id,
			}),
		},

		user: {
			accounts: r.many.account(),
			subscriptions: r.many.subscriptions(),
			categories: r.many.categories({
				from: r.user.id.through(r.subscriptions.userId),
				to: r.categories.id.through(r.subscriptions.categoryId),
			}),
			whatsappPairing: r.one.whatsappPairings(),
		},

		whatsappPairings: {
			user: r.one.user({
				from: r.whatsappPairings.userId,
				to: r.user.id,
			}),
		},

		account: {
			user: r.one.user({
				from: r.account.userId,
				to: r.user.id,
			}),
		},

		subscriptions: {
			user: r.one.user({
				from: r.subscriptions.userId,
				to: r.user.id,
			}),
			category: r.one.categories({
				from: r.subscriptions.categoryId,
				to: r.categories.id,
			}),
		},
	}),
);
