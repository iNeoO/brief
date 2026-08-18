import {
	BRIEFS_PAGE_SIZE,
	CATEGORY_JOB_STATUS,
	FILE_KIND,
	PAGINATION,
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
import {
	parseSourceLines,
	readingMinutes,
	toBriefScript,
	toExcerpt,
} from "./briefs.helper.js";
import type { BriefCard, BriefDetail, ListBriefsInput } from "./briefs.type.js";

/**
 * A brief is a category job the pipeline carried all the way through. Anything
 * still running, failed, or finished without a script is not one — hence the
 * summary check next to the status: a job can reach `finished` with the report
 * step skipped on a replay.
 */
const isPublished = and(
	eq(schema.categoryJobs.status, CATEGORY_JOB_STATUS.FINISHED),
	isNotNull(schema.categoryJobs.summary),
);

/**
 * Public read model over the pipeline's tables. It is deliberately separate
 * from `CategoryJobsService`, which owns the claim/retry/transition side: the
 * two never share a query, and mixing them would put unauthenticated reads in
 * the middle of the state machine.
 */
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

	/**
	 * The audio row of the brief, in the category's own language. Left-joined:
	 * a brief whose audio step failed is still readable, and hiding it would be
	 * worse than showing it without a player.
	 */
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
			// `finished` implies a `finishedAt` at the database level; the fallback
			// only satisfies the nullable column type.
			publishedAt: row.publishedAt ?? row.targetDate,
			excerpt: toExcerpt(summary),
			readingMinutes: readingMinutes(summary),
			audioFileId: row.audioFileId,
		};
	}

	/** Newest briefs across every category, for the landing page. */
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

	/** The archive, newest first. */
	async list({
		page = PAGINATION.DEFAULT_PAGE,
		pageSize = BRIEFS_PAGE_SIZE,
	}: ListBriefsInput = {}): Promise<Paginated<BriefCard>> {
		const [rows, [totals]] = await Promise.all([
			this.db
				.select(this.cardColumns)
				.from(schema.categoryJobs)
				.innerJoin(
					schema.categories,
					eq(schema.categories.id, schema.categoryJobs.categoryId),
				)
				.leftJoin(schema.files, this.audioJoin)
				.where(isPublished)
				// The id breaks ties: several categories publish on the same date,
				// and without it a brief could swap pages and disappear.
				.orderBy(
					desc(schema.categoryJobs.targetDate),
					desc(schema.categoryJobs.id),
				)
				.limit(pageSize)
				.offset((page - 1) * pageSize),

			this.db
				.select({ total: sql<number>`count(*)::int` })
				.from(schema.categoryJobs)
				.where(isPublished),
		]);

		const total = totals?.total ?? 0;

		return {
			items: rows.map((row) => this.toCard(row)),
			total,
			page,
			pageSize,
			pageCount: Math.max(1, Math.ceil(total / pageSize)),
		};
	}

	/**
	 * The audio row behind a published brief, or null. The join is the access
	 * check: a file id alone must not stream anything, or a job still running
	 * would be readable through its audio.
	 */
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

	/** One brief with its script, its audio and the articles behind it. */
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

		// The writer lists what it actually used, in the order the script covers
		// it; the rows above are the whole selection, which can be larger. Going
		// through the URL is what gives each line back its provider name.
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
