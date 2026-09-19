import {
	CATEGORY_JOB_STATE,
	FILE_KIND,
	INTERNAL_ERROR_CODE,
} from "@brief/common/constants";
import type { Language } from "@brief/common/types";
import { type Database, eq, schema } from "@brief/drizzle";
import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";
import { chat, toolDefinition } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import { z } from "zod";
import type { ArticlesService } from "../articles/articles.service.js";
import type { CategoryJobsService } from "../categoryJobs/categoryJobs.service.js";
import type { ClaimedCategoryJob } from "../categoryJobs/categoryJobs.type.js";
import type { S3Service } from "../s3/s3.service.js";
import { TextToSpeechHelper } from "../tts/tts.helper.js";
import { createAiDebugLogger } from "./processing.aiLogger.js";
import {
	ARTICLE_SELECTION_SYSTEM_PROMPT,
	buildArticleSelectionUserPrompt,
	buildResumeUserPrompt,
	RESUME_SYSTEM_PROMPT,
} from "./processing.prompt.js";
import type { CategoryJobContext, CategoryJobStep } from "./processing.type.js";

const MAX_SELECTED_ARTICLES = 10;
const BASE_SUMMARY_WORDS = 190;
const WORDS_PER_ARTICLE = 130;
const MAX_SUMMARY_WORDS = 750;

export class ProcessingService {
	constructor(
		private articlesService: ArticlesService,
		private categoryJobsService: CategoryJobsService,
		private db: Database,
		private s3Service: S3Service,
	) {}

	private readonly steps: CategoryJobStep[] = [
		{
			state: CATEGORY_JOB_STATE.CREATING_REPORT,
			run: (context) => this.createReport(context),
		},
		{
			state: CATEGORY_JOB_STATE.CREATING_AUDIO,
			run: (context) => this.createAudio(context),
		},
		{
			state: CATEGORY_JOB_STATE.SENDING_MESSAGE,
			run: (context) => this.verifyDeliverable(context),
		},
	];

	async runCategoryJob(job: ClaimedCategoryJob) {
		const startIndex = this.steps.findIndex((step) => step.state === job.state);

		if (startIndex === -1) {
			throw new InternalError({
				code: INTERNAL_ERROR_CODE.CATEGORY_JOB_UNKNOWN_STATE,
				message: `Category job ${job.id} sits in the unknown state "${job.state}"`,
			});
		}

		const context: CategoryJobContext = { job, summary: job.summary };

		for (const [index, step] of this.steps.slice(startIndex).entries()) {
			await step.run(context);

			const next = this.steps[startIndex + index + 1]?.state;
			const updated = await this.categoryJobsService.completeStep(
				job.id,
				step.state,
				next,
			);

			if (!updated) {
				throw new InternalError({
					code: INTERNAL_ERROR_CODE.CATEGORY_JOB_STATE_CONFLICT,
					message: `Category job ${job.id} left state "${step.state}" while it was being processed`,
				});
			}
		}

		return context;
	}

	private async createReport(context: CategoryJobContext) {
		const { job } = context;

		const selection = await this.makeSelection(
			job.id,
			job.targetDate,
			job.category,
		);

		if (selection.length === 0) {
			throw new InternalError({
				code: INTERNAL_ERROR_CODE.NO_ARTICLES_SELECTED,
				message: `No articles selected for category ${job.category.name} on ${job.targetDate.toISOString()}`,
			});
		}

		await this.setRanking(job.id, selection);

		const { summary, sources } = await this.makeSummary(
			selection,
			job.targetDate,
			job.category,
		);

		const [updated] = await this.categoryJobsService.setReport(job.id, {
			summary,
			sources,
		});

		if (!updated) {
			throw new InternalError({
				code: INTERNAL_ERROR_CODE.CATEGORY_JOB_STATE_CONFLICT,
				message: `Category job ${job.id} left state "${CATEGORY_JOB_STATE.CREATING_REPORT}" before its report could be stored`,
			});
		}

		context.summary = summary;
	}

	private async createAudio(context: CategoryJobContext) {
		const { job, summary } = context;

		if (!summary) {
			throw new InternalError({
				code: INTERNAL_ERROR_CODE.CATEGORY_JOB_MISSING_SUMMARY,
				message: `Category job ${job.id} reached the audio step without a summary`,
			});
		}

		const audio = await TextToSpeechHelper.textToAudio(
			summary,
			job.category.language,
		);

		await this.s3Service.uploadFile({
			categoryJobId: job.id,
			kind: FILE_KIND.AUDIO_FILE,
			language: job.category.language,
			body: audio.body,
			mimeType: audio.mimeType,
		});
	}

	/**
	 * The last step of the pipeline no longer sends anything: delivery belongs to
	 * the reader, is fanned out per subscriber, and happens after the job is
	 * `finished`. `sending_message` now means "everything is produced, distribution
	 * is somebody else's turn", and this step is what earns the job that claim.
	 *
	 * The check has to live *here*, before `markFinished`. Noticing a missing audio
	 * afterwards would mean moving a `finished` job back to `failed` — unpublishing
	 * a brief already visible on the site. Failing here leaves the usual trail
	 * instead: an `error`, a `category_job_events` row, and nothing published.
	 *
	 * Its other job is to let the fan-out trust the invariant rather than re-check
	 * it: past this point a finished category job has a summary and an audio file.
	 */
	private async verifyDeliverable(context: CategoryJobContext) {
		const { job, summary } = context;

		if (!summary) {
			throw new InternalError({
				code: INTERNAL_ERROR_CODE.CATEGORY_JOB_MISSING_SUMMARY,
				message: `Category job ${job.id} reached the delivery step without a summary`,
			});
		}

		const audio = await this.db.query.files.findFirst({
			columns: { id: true },
			where: {
				categoryJobId: job.id,
				kind: FILE_KIND.AUDIO_FILE,
				language: job.category.language,
			},
		});

		if (!audio) {
			throw new InternalError({
				code: INTERNAL_ERROR_CODE.CATEGORY_JOB_MISSING_AUDIO,
				message: `Category job ${job.id} has no ${job.category.language} audio file to deliver`,
			});
		}
	}

	private buildGetArticlesTool(
		observed: Awaited<ReturnType<ArticlesService["getObservedArticles"]>>,
	) {
		return toolDefinition({
			name: "getArticles",
			description: "Get articles by day and provider IDs",
			inputSchema: z.object({
				day: z.iso.date(),
				providerIds: z.array(z.string()).optional(),
			}),
			// Dates travel as ISO strings: a tool schema is handed to the model as
			// JSON Schema, which has no way to express a `Date`.
			outputSchema: z.array(
				z.object({
					id: z.string(),
					providerId: z.string(),
					title: z.string(),
					description: z.string().nullable(),
					publishedAt: z.iso.datetime().nullable(),
				}),
			),
			// `day` stays part of the contract because the system prompt tells the
			// model to pass it, but `observed` already comes from this category
			// job's immutable fetch snapshot, so there's nothing left to filter by
			// day — only `providerIds` narrows the result.
		}).server(async ({ providerIds }) => {
			return observed
				.filter(
					(article) =>
						!providerIds?.length || providerIds.includes(article.providerId),
				)
				.map((article) => ({
					id: article.id,
					providerId: article.providerId,
					title: article.title,
					description: article.description,
					publishedAt: article.publishedAt?.toISOString() ?? null,
				}));
		});
	}

	private readonly getArticleTool = toolDefinition({
		name: "getArticle",
		description: "Get an article by its ID",
		inputSchema: z.object({ id: z.string() }),
		outputSchema: z
			.object({
				id: z.string(),
				providerId: z.string(),
				title: z.string(),
				description: z.string().nullable(),
				content: z.string(),
				url: z.string(),
				publishedAt: z.iso.datetime().nullable(),
			})
			.nullable(),
	}).server(async ({ id }) => {
		const article = await this.articlesService.getArticle(id);
		if (!article) return null;
		return {
			id: article.id,
			providerId: article.providerId,
			title: article.title,
			description: article.description,
			content: article.content,
			url: article.url,
			publishedAt: article.publishedAt?.toISOString() ?? null,
		};
	});

	async setRanking(
		categoryJobId: number,
		articles: { id: string; rank: number }[],
	) {
		return await this.db.transaction(async (tx) => {
			await tx
				.delete(schema.categoryJobArticles)
				.where(eq(schema.categoryJobArticles.categoryJobId, categoryJobId));

			return await tx.insert(schema.categoryJobArticles).values(
				articles.map((article) => ({
					categoryJobId,
					articleId: article.id,
					rank: article.rank,
				})),
			);
		});
	}

	private normalizeSelection<TArticle extends { id: string; rank: number }>(
		selection: TArticle[],
		candidateIds: Set<string>,
	): TArticle[] {
		const kept = new Set<string>();

		return [...selection]
			.sort((a, b) => a.rank - b.rank)
			.filter((article) => {
				if (!candidateIds.has(article.id) || kept.has(article.id)) return false;
				kept.add(article.id);
				return true;
			})
			.map((article, index) => ({ ...article, rank: index }));
	}

	async makeSelection(
		categoryJobId: number,
		targetDate: Date,
		category: { name: string; description: string },
	) {
		const observed =
			await this.articlesService.getObservedArticles(categoryJobId);
		const providerIds = [...new Set(observed.map((a) => a.providerId))];

		const selection = await chat({
			adapter: openaiText("gpt-5.5"),
			stream: false,
			debug: { logger: createAiDebugLogger(getLoggerStore()) },
			systemPrompts: [ARTICLE_SELECTION_SYSTEM_PROMPT],
			messages: [
				{
					role: "user",
					content: buildArticleSelectionUserPrompt({
						categoryName: category.name,
						categoryDescription: category.description,
						targetDate,
						providerIds,
						maxArticles: MAX_SELECTED_ARTICLES,
					}),
				},
			],
			tools: [this.buildGetArticlesTool(observed)],
			// The selection is wrapped in an object: a structured output whose root
			// is an array comes back empty, the model never fills it.
			//
			// Ids and ranks only. Making the model copy titles back verbatim spends
			// its output budget on text the database already holds — on a busy day
			// it runs out before finishing, and the call returns nothing at all.
			outputSchema: z.object({
				articles: z.array(z.object({ id: z.string(), rank: z.number() })),
			}),
		});

		const byId = new Map(observed.map((article) => [article.id, article]));

		return this.normalizeSelection(selection.articles, new Set(byId.keys()))
			.map(({ id, rank }) => {
				const article = byId.get(id);
				return article
					? { id, rank, providerId: article.providerId, title: article.title }
					: null;
			})
			.filter((article) => article !== null);
	}

	async makeSummary(
		articles: { id: string; title: string; rank: number }[],
		targetDate: Date,
		category: { name: string; language: Language },
	) {
		const targetWordCount = Math.min(
			BASE_SUMMARY_WORDS + articles.length * WORDS_PER_ARTICLE,
			MAX_SUMMARY_WORDS,
		);

		const resume = await chat({
			adapter: openaiText("gpt-5.5"),
			stream: false,
			debug: { logger: createAiDebugLogger(getLoggerStore()) },
			systemPrompts: [RESUME_SYSTEM_PROMPT],
			messages: [
				{
					role: "user",
					content: buildResumeUserPrompt({
						categoryName: category.name,
						targetDate,
						language: category.language,
						targetWordCount,
						articles,
					}),
				},
			],
			tools: [this.getArticleTool],
			outputSchema: z.object({ summary: z.string(), sources: z.string() }),
		});

		return { summary: resume.summary, sources: resume.sources };
	}
}
