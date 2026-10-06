import {
	CATEGORY_JOB_OUTCOME,
	CATEGORY_JOB_STATE,
	FILE_KIND,
	INTERNAL_ERROR_CODE,
} from "@brief/common/constants";
import type { CategoryJobOutcome, Language } from "@brief/common/types";
import { type Database, eq, schema } from "@brief/drizzle";
import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";
import {
	type AnyTextAdapter,
	chat,
	maxToolCalls,
	toolDefinition,
} from "@tanstack/ai";
import { z } from "zod";
import { withDeadline } from "../../helpers/withDeadline.helper.js";
import type { ArticlesService } from "../articles/articles.service.js";
import type { CategoryJobsService } from "../categoryJobs/categoryJobs.service.js";
import type { ClaimedCategoryJob } from "../categoryJobs/categoryJobs.type.js";
import { buildAudioTitle } from "../messageJobs/messageJobs.helper.js";
import type { S3Service } from "../s3/s3.service.js";
import { TextToSpeechHelper } from "../tts/tts.helper.js";
import { createAiDebugLogger } from "./processing.aiLogger.js";
import {
	ARTICLE_SELECTION_SYSTEM_PROMPT,
	buildArticleSelectionUserPrompt,
	buildResumeUserPrompt,
	RESUME_SYSTEM_PROMPT,
} from "./processing.prompt.js";
import { createRunErrorCollector } from "./processing.runError.js";
import type {
	CategoryJobContext,
	CategoryJobRun,
	CategoryJobStep,
} from "./processing.type.js";
import {
	createUsageCollector,
	type TokenUsageTotals,
} from "./processing.usage.js";

const MAX_SELECTED_ARTICLES = 10;

class ToolProtocolError extends InternalError {
	constructor(
		message: string,
		readonly usage: TokenUsageTotals,
	) {
		super({ code: INTERNAL_ERROR_CODE.AI_PROTOCOL_VIOLATION, message });
		Object.setPrototypeOf(this, ToolProtocolError.prototype);
	}
}

type ServedArticles = { calls: number; refs: Set<number> };

/**
 * Wall-clock ceilings for the two model runs, not budgets for a single request:
 * one `AbortController` covers a whole agentic run, tool calls included, and the
 * summary can spend a turn per article. Generous on purpose — the point is to
 * catch a run that has stopped progressing, not to cut a slow one short.
 */
const SELECTION_DEADLINE_MS = 300_000;
const SUMMARY_DEADLINE_MS = 600_000;
const BASE_SUMMARY_WORDS = 190;
const WORDS_PER_ARTICLE = 130;
const MAX_SUMMARY_WORDS = 750;

const isSchemaViolation = (err: unknown): err is Error =>
	err instanceof Error &&
	"code" in err &&
	err.code === "structured-output-validation-failed";

// Strict structured outputs enforce min/max, so the model cannot decode an index outside the list.
const boundedIndex = (min: number, count: number) =>
	count > 0
		? z
				.number()
				.int()
				.min(min)
				.max(min + count - 1)
		: z.number().int();

export class ProcessingService {
	constructor(
		private articlesService: ArticlesService,
		private categoryJobsService: CategoryJobsService,
		private db: Database,
		private s3Service: S3Service,
		private readonly textAdapters: {
			selection: AnyTextAdapter;
			summary: AnyTextAdapter;
		},
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

	async runCategoryJob(job: ClaimedCategoryJob): Promise<CategoryJobRun> {
		const startIndex = this.steps.findIndex((step) => step.state === job.state);

		if (startIndex === -1) {
			throw new InternalError({
				code: INTERNAL_ERROR_CODE.CATEGORY_JOB_UNKNOWN_STATE,
				message: `Category job ${job.id} sits in the unknown state "${job.state}"`,
			});
		}

		const context: CategoryJobContext = { job, summary: job.summary };

		for (const [index, step] of this.steps.slice(startIndex).entries()) {
			const outcome = await step.run(context);

			// A step that settled the job itself owns the row now: it has already
			// written a terminal status and a `finished_at`, so completing the state
			// it was in would only move a job that is over.
			if (outcome !== CATEGORY_JOB_OUTCOME.PRODUCED) {
				return { outcome, context };
			}

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

		return { outcome: CATEGORY_JOB_OUTCOME.PRODUCED, context };
	}

	private async createReport(
		context: CategoryJobContext,
	): Promise<CategoryJobOutcome> {
		const { job } = context;

		const selection = await this.billingViolations(job.id, () =>
			this.makeSelection(job.id, job.targetDate, job.category),
		);

		// Recorded before the guard below and before the summary: a job that fails
		// halfway through the report was still billed for what it spent, and the
		// figure is only useful if a failure cannot hide it. `addTokenUsage` adds to
		// what is already there, so a retried step accumulates rather than
		// overwrites — three attempts cost three attempts.
		await this.addUsage(job.id, selection.usage);

		// A day the editor found nothing worth reporting on. Not an error: retrying
		// replays the same articles through the same prompt and reaches the same
		// verdict, three times over, for a brief there was never anything to write.
		// The job is settled here and the run ends — no summary, no audio, no
		// delivery, and no `error` to make a quiet day look like an incident.
		if (selection.articles.length === 0) {
			const [settled] = await this.categoryJobsService.markNoArticlesSelected(
				job.id,
			);

			if (!settled) {
				throw new InternalError({
					code: INTERNAL_ERROR_CODE.CATEGORY_JOB_STATE_CONFLICT,
					message: `Category job ${job.id} left state "${CATEGORY_JOB_STATE.CREATING_REPORT}" before its empty selection could be recorded`,
				});
			}

			getLoggerStore().info(
				{
					jobId: job.id,
					category: job.category.name,
					targetDate: job.targetDate,
				},
				"no articles selected, nothing to brief",
			);

			return CATEGORY_JOB_OUTCOME.NO_ARTICLES_SELECTED;
		}

		await this.setRanking(job.id, selection.articles);

		const { summary, sources, usage } = await this.billingViolations(
			job.id,
			() => this.makeSummary(selection.articles, job.targetDate, job.category),
		);

		await this.addUsage(job.id, usage);

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

		return CATEGORY_JOB_OUTCOME.PRODUCED;
	}

	private async billingViolations<T>(jobId: number, run: () => Promise<T>) {
		try {
			return await run();
		} catch (err) {
			if (err instanceof ToolProtocolError)
				await this.addUsage(jobId, err.usage);
			throw err;
		}
	}

	/**
	 * Bookkeeping only: a failure to record what a call cost must not fail the
	 * brief that call already paid for. The log line from the collector stands
	 * either way, so the figure is never lost outright.
	 */
	private async addUsage(jobId: number, usage: TokenUsageTotals) {
		try {
			await this.categoryJobsService.addTokenUsage(jobId, usage);
		} catch (err) {
			getLoggerStore().error(
				{ err, jobId, ...usage },
				"could not record token usage",
			);
		}
	}

	private async createAudio(
		context: CategoryJobContext,
	): Promise<CategoryJobOutcome> {
		const { job, summary } = context;

		if (!summary) {
			throw new InternalError({
				code: INTERNAL_ERROR_CODE.CATEGORY_JOB_MISSING_SUMMARY,
				message: `Category job ${job.id} reached the audio step without a summary`,
			});
		}

		// The same name Telegram shows in its player, so a file saved out of the
		// chat and a file downloaded from the page answer to one title.
		const audio = await TextToSpeechHelper.textToAudio({
			text: summary,
			language: job.category.language,
			targetDate: job.targetDate,
			title: buildAudioTitle({
				categoryName: job.category.name,
				targetDate: job.targetDate,
				locale: job.category.language,
			}),
		});

		await this.s3Service.uploadFile({
			categoryJobId: job.id,
			kind: FILE_KIND.AUDIO_FILE,
			language: job.category.language,
			body: audio.body,
			mimeType: audio.mimeType,
		});

		return CATEGORY_JOB_OUTCOME.PRODUCED;
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
	private async verifyDeliverable(
		context: CategoryJobContext,
	): Promise<CategoryJobOutcome> {
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

		return CATEGORY_JOB_OUTCOME.PRODUCED;
	}

	private buildGetArticlesTool(
		observed: Awaited<ReturnType<ArticlesService["getObservedArticles"]>>,
		served: ServedArticles,
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
					// Small models copy a short integer reliably where they mangle a uuid.
					ref: z.number().int(),
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
			served.calls += 1;
			const matching = observed
				.map((article, index) => ({ ...article, ref: index + 1 }))
				.filter(
					(article) =>
						!providerIds?.length || providerIds.includes(article.providerId),
				);
			for (const { ref } of matching) served.refs.add(ref);
			return matching.map((article) => ({
				ref: article.ref,
				providerId: article.providerId,
				title: article.title,
				description: article.description,
				publishedAt: article.publishedAt?.toISOString() ?? null,
			}));
		});
	}

	private buildGetArticleTool(
		selection: { id: string; rank: number }[],
		fetched: Set<number>,
	) {
		const byRank = new Map(selection.map((article) => [article.rank, article]));

		return toolDefinition({
			name: "getArticle",
			description: "Get a selected article by its rank",
			inputSchema: z.object({ rank: boundedIndex(0, selection.length) }),
			outputSchema: z
				.object({
					providerId: z.string(),
					title: z.string(),
					description: z.string().nullable(),
					content: z.string(),
					url: z.string(),
					publishedAt: z.iso.datetime().nullable(),
				})
				.nullable(),
			// Only the ranks this job selected resolve, so the tool can never hand the
			// model an article from another category or day.
		}).server(async ({ rank }) => {
			fetched.add(rank);
			const selected = byRank.get(rank);
			if (!selected) {
				getLoggerStore().warn(
					{ rank },
					"getArticle asked for a rank outside the selection",
				);
				return null;
			}

			const article = await this.articlesService.getArticle(selected.id);
			if (!article) return null;
			return {
				providerId: article.providerId,
				title: article.title,
				description: article.description,
				content: article.content,
				url: article.url,
				publishedAt: article.publishedAt?.toISOString() ?? null,
			};
		});
	}

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
	): TArticle[] {
		const kept = new Set<string>();

		return [...selection]
			.sort((a, b) => a.rank - b.rank)
			.filter((article) => {
				if (kept.has(article.id)) return false;
				kept.add(article.id);
				return true;
			})
			.map((article, index) => ({ ...article, rank: index }));
	}

	// Filtering out a skipped call or invented refs would pass a broken run off as a quiet day.
	private assertSelectionProtocol(
		selection: { ref: number }[],
		served: ServedArticles,
		usage: TokenUsageTotals,
	) {
		if (served.calls === 0) {
			throw new ToolProtocolError(
				`Article selection answered without calling getArticles (${selection.length} refs returned)`,
				usage,
			);
		}

		const invented = selection.filter(({ ref }) => !served.refs.has(ref));
		if (invented.length > 0) {
			throw new ToolProtocolError(
				`Article selection returned ${invented.length} refs that getArticles never served`,
				usage,
			);
		}
	}

	async makeSelection(
		categoryJobId: number,
		targetDate: Date,
		category: { name: string; description: string },
	) {
		const observed =
			await this.articlesService.getObservedArticles(categoryJobId);
		const providerIds = [...new Set(observed.map((a) => a.providerId))];

		const usage = createUsageCollector(
			"selection",
			this.textAdapters.selection.model,
		);
		const runError = createRunErrorCollector();
		const served: ServedArticles = { calls: 0, refs: new Set() };

		const selection = await withDeadline({
			context: "Article selection",
			timeoutMs: SELECTION_DEADLINE_MS,
			timeoutCode: INTERNAL_ERROR_CODE.AI_TIMEOUT,
			run: (abortController) =>
				chat({
					abortController,
					adapter: this.textAdapters.selection,
					stream: false,
					debug: { logger: createAiDebugLogger(getLoggerStore()) },
					middleware: [usage.middleware, runError.middleware],
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
					tools: [this.buildGetArticlesTool(observed, served)],
					// The selection is wrapped in an object: a structured output whose root
					// is an array comes back empty, the model never fills it.
					//
					// Refs and ranks only. Making the model copy titles back verbatim spends
					// its output budget on text the database already holds — on a busy day
					// it runs out before finishing, and the call returns nothing at all.
					outputSchema: z.object({
						articles: z.array(
							z.object({
								ref: boundedIndex(1, observed.length),
								rank: z.number(),
							}),
						),
					}),
				}).catch((err) => {
					// A non-strict upstream can still answer a ref outside the bounds; it is the same broken protocol, and its cost must be recorded.
					if (isSchemaViolation(err)) {
						throw new ToolProtocolError(
							`Article selection answered outside its schema: ${err.message}`,
							usage.report(),
						);
					}
					throw runError.explain(err);
				}),
		});

		const report = usage.report();
		this.assertSelectionProtocol(selection.articles, served, report);

		const articles = this.normalizeSelection(
			selection.articles.flatMap(({ ref, rank }) => {
				const article = observed[ref - 1];
				return article
					? [
							{
								id: article.id,
								rank,
								providerId: article.providerId,
								title: article.title,
							},
						]
					: [];
			}),
		);

		return { articles, usage: report };
	}

	async makeSummary(
		selection: { id: string; title: string; rank: number }[],
		targetDate: Date,
		category: { name: string; language: Language },
	) {
		// getArticle's bounds assume ranks 0..n-1, whatever spacing the caller used.
		const articles = [...selection]
			.sort((a, b) => a.rank - b.rank)
			.map((article, rank) => ({ ...article, rank }));
		const targetWordCount = Math.min(
			BASE_SUMMARY_WORDS + articles.length * WORDS_PER_ARTICLE,
			MAX_SUMMARY_WORDS,
		);

		const usage = createUsageCollector(
			"summary",
			this.textAdapters.summary.model,
		);
		const runError = createRunErrorCollector();
		const fetched = new Set<number>();

		const resume = await withDeadline({
			context: "Brief writing",
			timeoutMs: SUMMARY_DEADLINE_MS,
			timeoutCode: INTERNAL_ERROR_CODE.AI_TIMEOUT,
			run: (abortController) =>
				chat({
					abortController,
					adapter: this.textAdapters.summary,
					stream: false,
					debug: { logger: createAiDebugLogger(getLoggerStore()) },
					middleware: [usage.middleware, runError.middleware],
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
					tools: [this.buildGetArticleTool(articles, fetched)],
					// The prompt asks for one getArticle call per selected article. The
					// default loop strategy allows 5 model turns, which only holds while
					// the model batches those calls in parallel: fetch them one per turn
					// and the loop ends early, the summary then gets written from the
					// handful of articles that made it through, with no error raised.
					// Bound the tool calls instead, with room for a retry or two.
					agentLoopStrategy: maxToolCalls(MAX_SELECTED_ARTICLES + 2),
					outputSchema: z.object({ summary: z.string(), sources: z.string() }),
				}).catch((err) => {
					throw runError.explain(err);
				}),
		});

		const report = usage.report();
		const unread = articles.filter(({ rank }) => !fetched.has(rank));
		if (unread.length > 0) {
			throw new ToolProtocolError(
				`Brief written without fetching ${unread.length} of its ${articles.length} articles: ${unread.map(({ id }) => id).join(", ")}`,
				report,
			);
		}

		return {
			summary: resume.summary,
			sources: resume.sources,
			usage: report,
		};
	}
}
