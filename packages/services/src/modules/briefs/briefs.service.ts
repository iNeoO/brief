import {
	BRIEFS_PAGE_SIZE,
	CATEGORY_JOB_STATUS,
	FILE_KIND,
	SITEMAP_MAX_BRIEFS,
} from "@brief/common/constants";
import type { Paginated } from "@brief/common/types";
import {
	and,
	asc,
	type Database,
	desc,
	eq,
	isNotNull,
	schema,
	sql,
} from "@brief/drizzle";
import { normalizePage, toPage } from "../../helpers/listQuery.helper.js";
import {
	parseSourceLines,
	readingMinutes,
	toBriefScript,
	toExcerpt,
} from "./briefs.helper.js";
import type {
	BriefCard,
	BriefDetail,
	BriefSitemapEntry,
	ListBriefsInput,
	ListSubscribedBriefsInput,
} from "./briefs.type.js";

const isPublished = and(
	eq(schema.categoryJobs.status, CATEGORY_JOB_STATUS.FINISHED),
	isNotNull(schema.categoryJobs.summary),
);

const subscribedBy = (userId: string) => sql`exists (
	select 1
	from ${schema.subscriptions}
	where ${schema.subscriptions.categoryId} = ${schema.categoryJobs.categoryId}
		and ${schema.subscriptions.userId} = ${userId}
)`;

export class BriefsService {
	constructor(private db: Database) {}

	private get cardColumns() {
		return {
			id: schema.categoryJobs.id,
			categoryId: schema.categories.id,
			categoryName: schema.categories.name,
			language: schema.categories.language,
			targetDate: schema.categoryJobs.targetDate,
			publishedAt: schema.categoryJobs.finishedAt,
			summary: schema.categoryJobs.summary,
			audioFileId: schema.files.id,
		};
	}

	private get audioJoin() {
		return and(
			eq(schema.files.categoryJobId, schema.categoryJobs.id),
			eq(schema.files.kind, FILE_KIND.AUDIO_FILE),
			eq(schema.files.language, schema.categories.language),
		);
	}

	private toCard(row: {
		id: number;
		categoryId: string;
		categoryName: string;
		language: BriefCard["language"];
		targetDate: Date;
		publishedAt: Date | null;
		summary: string | null;
		audioFileId: string | null;
	}): BriefCard {
		const summary = row.summary ?? "";

		return {
			id: row.id,
			categoryId: row.categoryId,
			categoryName: row.categoryName,
			language: row.language,
			targetDate: row.targetDate,
			publishedAt: row.publishedAt ?? row.targetDate,
			excerpt: toExcerpt(summary),
			readingMinutes: readingMinutes(summary),
			audioFileId: row.audioFileId,
		};
	}

	async listLatest(limit: number): Promise<BriefCard[]> {
		const rows = await this.db
			.select(this.cardColumns)
			.from(schema.categoryJobs)
			.innerJoin(
				schema.categories,
				eq(schema.categories.id, schema.categoryJobs.categoryId),
			)
			.leftJoin(schema.files, this.audioJoin)
			.where(isPublished)
			.orderBy(
				desc(schema.categoryJobs.targetDate),
				desc(schema.categoryJobs.id),
			)
			.limit(limit);

		return rows.map((row) => this.toCard(row));
	}

	async list(input: ListBriefsInput = {}): Promise<Paginated<BriefCard>> {
		return this.listPage(input);
	}

	async listSitemapEntries(
		limit = SITEMAP_MAX_BRIEFS,
	): Promise<BriefSitemapEntry[]> {
		const rows = await this.db
			.select({
				id: schema.categoryJobs.id,
				targetDate: schema.categoryJobs.targetDate,
				publishedAt: schema.categoryJobs.finishedAt,
			})
			.from(schema.categoryJobs)
			.innerJoin(
				schema.categories,
				eq(schema.categories.id, schema.categoryJobs.categoryId),
			)
			.where(isPublished)
			.orderBy(
				desc(schema.categoryJobs.targetDate),
				desc(schema.categoryJobs.id),
			)
			.limit(limit);

		return rows.map((row) => ({
			id: row.id,
			updatedAt: row.publishedAt ?? row.targetDate,
		}));
	}

	async listSubscribed({
		userId,
		...input
	}: ListSubscribedBriefsInput): Promise<Paginated<BriefCard>> {
		return this.listPage(input, userId);
	}

	private async listPage(
		input: ListBriefsInput,
		userId?: string,
	): Promise<Paginated<BriefCard>> {
		const pageWindow = normalizePage(input, {
			defaultPageSize: BRIEFS_PAGE_SIZE,
		});
		const where = userId ? and(isPublished, subscribedBy(userId)) : isPublished;

		const [rows, [totals]] = await Promise.all([
			this.db
				.select(this.cardColumns)
				.from(schema.categoryJobs)
				.innerJoin(
					schema.categories,
					eq(schema.categories.id, schema.categoryJobs.categoryId),
				)
				.leftJoin(schema.files, this.audioJoin)
				.where(where)
				.orderBy(
					desc(schema.categoryJobs.targetDate),
					desc(schema.categoryJobs.id),
				)
				.limit(pageWindow.pageSize)
				.offset(pageWindow.offset),

			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(schema.categoryJobs)
				.where(where),
		]);

		return toPage(
			rows.map((row) => this.toCard(row)),
			totals?.total ?? 0,
			pageWindow,
		);
	}

	async findPublishedAudio(fileId: string) {
		const [row] = await this.db
			.select({
				id: schema.files.id,
				mimeType: schema.files.mimeType,
				categoryName: schema.categories.name,
				targetDate: schema.categoryJobs.targetDate,
			})
			.from(schema.files)
			.innerJoin(
				schema.categoryJobs,
				eq(schema.categoryJobs.id, schema.files.categoryJobId),
			)
			.innerJoin(
				schema.categories,
				eq(schema.categories.id, schema.categoryJobs.categoryId),
			)
			.where(
				and(
					isPublished,
					eq(schema.files.id, fileId),
					eq(schema.files.kind, FILE_KIND.AUDIO_FILE),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async getById(id: number): Promise<BriefDetail | null> {
		const [row] = await this.db
			.select({
				...this.cardColumns,
				categoryDescription: schema.categories.description,
				sourceLines: schema.categoryJobs.sources,
				audioFilename: schema.files.filename,
				audioMimeType: schema.files.mimeType,
				audioSize: schema.files.size,
			})
			.from(schema.categoryJobs)
			.innerJoin(
				schema.categories,
				eq(schema.categories.id, schema.categoryJobs.categoryId),
			)
			.leftJoin(schema.files, this.audioJoin)
			.where(and(isPublished, eq(schema.categoryJobs.id, id)))
			.limit(1);

		if (!row) return null;

		const sources = await this.db
			.select({
				rank: schema.categoryJobArticles.rank,
				title: schema.articles.title,
				url: schema.articles.url,
				providerName: schema.providers.name,
				publishedAt: schema.articles.publishedAt,
			})
			.from(schema.categoryJobArticles)
			.innerJoin(
				schema.articles,
				eq(schema.articles.id, schema.categoryJobArticles.articleId),
			)
			.innerJoin(
				schema.providers,
				eq(schema.providers.id, schema.articles.providerId),
			)
			.where(eq(schema.categoryJobArticles.categoryJobId, id))
			.orderBy(asc(schema.categoryJobArticles.rank));

		const { excerpt: _excerpt, ...card } = this.toCard(row);

		const sourceByUrl = new Map(sources.map((source) => [source.url, source]));
		const usedSources = parseSourceLines(row.sourceLines)
			.map(({ url }) => sourceByUrl.get(url))
			.filter((source) => source !== undefined);

		return {
			...card,
			categoryDescription: row.categoryDescription,
			script: toBriefScript(row.summary ?? "", usedSources),
			audio:
				row.audioFileId && row.audioFilename && row.audioMimeType
					? {
							id: row.audioFileId,
							filename: row.audioFilename,
							mimeType: row.audioMimeType,
							size: row.audioSize ?? 0,
						}
					: null,
			sources,
		};
	}
}
