import { Readable } from "node:stream";
import {
	CATEGORY_JOB_STATE,
	FILE_KIND,
	JOB_STATUS,
	LANGUAGE,
	MIME_TYPE,
} from "@brief/common/constants";
import type { CategoryJobState } from "@brief/common/types";
import type { Database } from "@brief/drizzle";
import { chat } from "@tanstack/ai";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { ArticlesService } from "../articles/articles.service.js";
import type { CategoryJobsService } from "../categoryJobs/categoryJobs.service.js";
import type { ClaimedCategoryJob } from "../categoryJobs/categoryJobs.type.js";
import type { S3Service } from "../s3/s3.service.js";
import { TextToSpeechHelper } from "../tts/tts.helper.js";
import { ARTICLE_SELECTION_SYSTEM_PROMPT } from "./processing.prompt.js";
import { ProcessingService } from "./processing.service.js";

vi.mock("@tanstack/ai", () => ({
	chat: vi.fn(),
	// The real builder hands the model a JSON schema; here only the handler the
	// service attaches matters, so the tests can call it the way the model would.
	toolDefinition: (definition: Record<string, unknown>) => ({
		...definition,
		server: (handler: unknown) => ({ ...definition, handler }),
	}),
	// Same semantics as the real strategy: keep looping while the run has made
	// fewer than `max` tool calls.
	maxToolCalls:
		(max: number) =>
		({ toolCallCount }: { toolCallCount: number }) =>
			toolCallCount < max,
}));

vi.mock("@tanstack/ai-openai", () => ({ openaiText: vi.fn(() => "adapter") }));

vi.mock("../tts/tts.helper.js", () => ({
	TextToSpeechHelper: { textToAudio: vi.fn() },
}));

type ToolStub = {
	name: string;
	handler: (input: Record<string, unknown>) => Promise<unknown>;
};

type UsageTotals = {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
};

type MiddlewareStub = {
	onIteration?: () => void;
	onUsage?: (ctx: unknown, usage: UsageTotals) => void;
};

type ChatCall = {
	systemPrompts: string[];
	messages: { content: string }[];
	tools: ToolStub[];
	middleware?: MiddlewareStub[];
	agentLoopStrategy?: (state: { toolCallCount: number }) => boolean;
};

const chatMock = chat as unknown as Mock;
const textToAudioMock = TextToSpeechHelper.textToAudio as unknown as Mock;

const chatCalls = (): ChatCall[] =>
	chatMock.mock.calls.map(([params]) => params);

const isSelectionCall = (call: ChatCall) =>
	call.systemPrompts[0] === ARTICLE_SELECTION_SYSTEM_PROMPT;

/**
 * What each call reports per iteration. The summary call reports twice, which is
 * the point: `onUsage` fires once per model iteration and the totals must add up
 * rather than keep the last one.
 */
const ITERATION_USAGE: UsageTotals = {
	promptTokens: 1_000,
	completionTokens: 100,
	totalTokens: 1_150,
};
const SUMMARY_ITERATIONS = 2;

/** Replays the iterations a real run would have reported to the middleware. */
const reportUsage = (call: ChatCall, iterations: number) => {
	for (const middleware of call.middleware ?? []) {
		for (let i = 0; i < iterations; i += 1) {
			middleware.onIteration?.();
			middleware.onUsage?.(undefined, ITERATION_USAGE);
		}
	}
};

const TARGET_DATE = new Date("2026-08-17T00:00:00.000Z");
const SUMMARY = "Voici le brief économie du 17 août.\n\nC'était le brief.";
const SOURCES = "0. Article 1 — https://example.test/article-1";

const observedArticle = (n: number, providerId = "provider-1") => ({
	id: `article-${n}`,
	providerId,
	title: `Article ${n}`,
	description: `Description ${n}`,
	publishedAt: new Date(`2026-08-17T0${n}:00:00.000Z`),
});

const job = (overrides: Partial<ClaimedCategoryJob> = {}): ClaimedCategoryJob =>
	({
		id: 42,
		categoryId: "category-1",
		targetDate: TARGET_DATE,
		status: JOB_STATUS.RUNNING,
		state: CATEGORY_JOB_STATE.CREATING_REPORT,
		summary: null,
		sources: null,
		error: null,
		retry: 0,
		createdAt: TARGET_DATE,
		updatedAt: TARGET_DATE,
		finishedAt: null,
		category: {
			id: "category-1",
			name: "Économie",
			description: "L'économie française et internationale.",
			language: LANGUAGE.FR,
			isEnabled: true,
			createdAt: TARGET_DATE,
			updatedAt: TARGET_DATE,
			providers: [],
		},
		...overrides,
	}) as ClaimedCategoryJob;

const getObservedArticles = vi.fn();
const getArticle = vi.fn();
const completeStep = vi.fn();
const setReport = vi.fn();
const addTokenUsage = vi.fn();
const uploadFile = vi.fn();

/** The ranking rows `setRanking` writes, in the order it writes them. */
const rankings: unknown[] = [];

const tx = {
	delete: () => ({ where: () => Promise.resolve() }),
	insert: () => ({
		values: (rows: unknown) => {
			rankings.push(rows);
			return Promise.resolve();
		},
	}),
};

/** What the delivery check finds; the happy path has an audio file. */
const findAudioFile = vi.fn(
	async () => ({ id: "file-1" }) as { id: string } | undefined,
);

const db = {
	transaction: vi.fn((run: (t: typeof tx) => Promise<unknown>) => run(tx)),
	query: { files: { findFirst: findAudioFile } },
};

const service = () =>
	new ProcessingService(
		{ getObservedArticles, getArticle } as unknown as ArticlesService,
		{
			completeStep,
			setReport,
			addTokenUsage,
		} as unknown as CategoryJobsService,
		db as unknown as Database,
		{ uploadFile } as unknown as S3Service,
	);

/** What the model answers, per call; each test overrides what it cares about. */
let modelSelection: { id: string; rank: number }[];

beforeEach(() => {
	vi.clearAllMocks();
	rankings.length = 0;
	modelSelection = [{ id: "article-1", rank: 0 }];
	findAudioFile.mockResolvedValue({ id: "file-1" });

	chatMock.mockImplementation(async (params: ChatCall) => {
		const selecting = isSelectionCall(params);
		reportUsage(params, selecting ? 1 : SUMMARY_ITERATIONS);

		return selecting
			? { articles: modelSelection }
			: { summary: SUMMARY, sources: SOURCES };
	});

	getObservedArticles.mockResolvedValue([observedArticle(1)]);
	completeStep.mockResolvedValue({ id: 42 });
	setReport.mockResolvedValue([{ id: 42 }]);
	addTokenUsage.mockResolvedValue({ id: 42 });
	textToAudioMock.mockResolvedValue({
		body: Readable.from([Buffer.from("audio")]),
		mimeType: MIME_TYPE.MP3,
	});
	uploadFile.mockResolvedValue(undefined);
});

describe("runCategoryJob", () => {
	it("walks a fresh job through report, audio and delivery", async () => {
		const context = await service().runCategoryJob(job());

		expect(context.summary).toBe(SUMMARY);
		expect(setReport).toHaveBeenCalledWith(42, {
			summary: SUMMARY,
			sources: SOURCES,
		});
		expect(textToAudioMock).toHaveBeenCalledWith(SUMMARY, LANGUAGE.FR);
		expect(uploadFile).toHaveBeenCalledWith(
			expect.objectContaining({
				categoryJobId: 42,
				kind: FILE_KIND.AUDIO_FILE,
				language: LANGUAGE.FR,
				mimeType: MIME_TYPE.MP3,
			}),
		);
		// Each step announces the state it just left and the one it moves to; the
		// last step has no successor and stays where it is.
		expect(completeStep.mock.calls).toEqual([
			[
				42,
				CATEGORY_JOB_STATE.CREATING_REPORT,
				CATEGORY_JOB_STATE.CREATING_AUDIO,
			],
			[
				42,
				CATEGORY_JOB_STATE.CREATING_AUDIO,
				CATEGORY_JOB_STATE.SENDING_MESSAGE,
			],
			[42, CATEGORY_JOB_STATE.SENDING_MESSAGE, undefined],
		]);
	});

	it("records what each call cost against the job", async () => {
		await service().runCategoryJob(job());

		// One write per call, summed over that call's iterations, so a job that
		// dies after the selection still shows what the selection cost.
		expect(addTokenUsage.mock.calls).toEqual([
			[42, ITERATION_USAGE],
			[
				42,
				{
					promptTokens: ITERATION_USAGE.promptTokens * SUMMARY_ITERATIONS,
					completionTokens:
						ITERATION_USAGE.completionTokens * SUMMARY_ITERATIONS,
					totalTokens: ITERATION_USAGE.totalTokens * SUMMARY_ITERATIONS,
				},
			],
		]);
	});

	it("still produces the brief when the usage write fails", async () => {
		addTokenUsage.mockRejectedValue(new Error("column is gone"));

		const context = await service().runCategoryJob(job());

		// Bookkeeping must never cost a brief that was already paid for.
		expect(context.summary).toBe(SUMMARY);
	});

	it("resumes a retried job at the step it stopped on", async () => {
		const resumed = job({
			state: CATEGORY_JOB_STATE.CREATING_AUDIO,
			summary: "Le brief déjà écrit.",
		});

		await service().runCategoryJob(resumed);

		// The report is paid for once: a retry must not call the model again.
		expect(chatMock).not.toHaveBeenCalled();
		expect(textToAudioMock).toHaveBeenCalledWith(
			"Le brief déjà écrit.",
			LANGUAGE.FR,
		);
		expect(completeStep).toHaveBeenCalledTimes(2);
	});

	// The check has to fail *here* rather than after the job is finished: a brief
	// that reached `finished` is already published on the site, and taking it back
	// would mean unpublishing it. Failing now also lets the fan-out trust that a
	// finished job has an audio file.
	it("refuses to finish a job whose audio never landed", async () => {
		findAudioFile.mockResolvedValue(undefined);

		await expect(
			service().runCategoryJob(
				job({
					state: CATEGORY_JOB_STATE.SENDING_MESSAGE,
					summary: "Le brief déjà écrit.",
				}),
			),
		).rejects.toMatchObject({ code: "CATEGORY_JOB_MISSING_AUDIO" });

		// The step never completed, so the job cannot be marked finished.
		expect(completeStep).not.toHaveBeenCalled();
	});

	it("lets a job with its audio through the delivery check", async () => {
		await service().runCategoryJob(
			job({
				state: CATEGORY_JOB_STATE.SENDING_MESSAGE,
				summary: "Le brief déjà écrit.",
			}),
		);

		expect(findAudioFile).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ categoryJobId: 42 }),
			}),
		);
		expect(completeStep).toHaveBeenCalledWith(
			42,
			CATEGORY_JOB_STATE.SENDING_MESSAGE,
			undefined,
		);
	});

	it("refuses a job sitting in a state it has no step for", async () => {
		await expect(
			service().runCategoryJob(
				job({ state: "polishing_shoes" as CategoryJobState }),
			),
		).rejects.toMatchObject({ code: "CATEGORY_JOB_UNKNOWN_STATE" });

		expect(chatMock).not.toHaveBeenCalled();
		expect(completeStep).not.toHaveBeenCalled();
	});

	it("stops when another worker has moved the job on underneath it", async () => {
		completeStep.mockResolvedValue(null);

		await expect(service().runCategoryJob(job())).rejects.toMatchObject({
			code: "CATEGORY_JOB_STATE_CONFLICT",
		});

		expect(completeStep).toHaveBeenCalledOnce();
		expect(textToAudioMock).not.toHaveBeenCalled();
	});

	it("does not voice a job that reached the audio step without a summary", async () => {
		await expect(
			service().runCategoryJob(
				job({ state: CATEGORY_JOB_STATE.CREATING_AUDIO, summary: null }),
			),
		).rejects.toMatchObject({ code: "CATEGORY_JOB_MISSING_SUMMARY" });

		expect(textToAudioMock).not.toHaveBeenCalled();
	});

	it("fails the job rather than writing a brief about nothing", async () => {
		modelSelection = [];

		await expect(service().runCategoryJob(job())).rejects.toMatchObject({
			code: "NO_ARTICLES_SELECTED",
		});

		expect(rankings).toEqual([]);
		// Only the selection call was made: no summary is written without articles.
		expect(chatCalls().filter((call) => !isSelectionCall(call))).toEqual([]);
	});

	it("throws when the report lands on a job that left the report state", async () => {
		setReport.mockResolvedValue([]);

		await expect(service().runCategoryJob(job())).rejects.toMatchObject({
			code: "CATEGORY_JOB_STATE_CONFLICT",
		});
	});

	it("stores the selection ranked, replacing whatever a previous attempt left", async () => {
		getObservedArticles.mockResolvedValue([
			observedArticle(1),
			observedArticle(2),
		]);
		modelSelection = [
			{ id: "article-2", rank: 1 },
			{ id: "article-1", rank: 0 },
		];

		await service().runCategoryJob(job());

		expect(db.transaction).toHaveBeenCalledOnce();
		expect(rankings).toEqual([
			[
				{ categoryJobId: 42, articleId: "article-1", rank: 0 },
				{ categoryJobId: 42, articleId: "article-2", rank: 1 },
			],
		]);
	});
});

describe("makeSelection", () => {
	const select = () =>
		service().makeSelection(42, TARGET_DATE, {
			name: "Économie",
			description: "L'économie française.",
		});

	it("returns the articles the model kept, in rank order", async () => {
		getObservedArticles.mockResolvedValue([
			observedArticle(1),
			observedArticle(2, "provider-2"),
		]);
		modelSelection = [
			{ id: "article-2", rank: 5 },
			{ id: "article-1", rank: 2 },
		];

		// Ranks come back contiguous from zero, whatever spacing the model used.
		await expect(select()).resolves.toEqual({
			articles: [
				{
					id: "article-1",
					rank: 0,
					providerId: "provider-1",
					title: "Article 1",
				},
				{
					id: "article-2",
					rank: 1,
					providerId: "provider-2",
					title: "Article 2",
				},
			],
			usage: ITERATION_USAGE,
		});
	});

	it("drops the ids the model invented and the ones it repeated", async () => {
		getObservedArticles.mockResolvedValue([observedArticle(1)]);
		modelSelection = [
			{ id: "article-1", rank: 0 },
			{ id: "article-1", rank: 1 },
			{ id: "hallucinated", rank: 2 },
		];

		await expect(select()).resolves.toEqual({
			articles: [
				{
					id: "article-1",
					rank: 0,
					providerId: "provider-1",
					title: "Article 1",
				},
			],
			usage: ITERATION_USAGE,
		});
	});

	it("returns nothing when no candidate fits the category", async () => {
		modelSelection = [];

		await expect(select()).resolves.toEqual({
			articles: [],
			usage: ITERATION_USAGE,
		});
	});

	it("gives the model the distinct providers of the day, once each", async () => {
		getObservedArticles.mockResolvedValue([
			observedArticle(1),
			observedArticle(2),
			observedArticle(3, "provider-2"),
		]);

		await select();

		const [prompt] = chatCalls().filter(isSelectionCall);
		expect(prompt.messages[0].content).toContain('["provider-1","provider-2"]');
	});
});

describe("makeSummary", () => {
	const summarize = (count: number) =>
		service().makeSummary(
			Array.from({ length: count }, (_, index) => ({
				id: `article-${index}`,
				title: `Article ${index}`,
				rank: index,
			})),
			TARGET_DATE,
			{ name: "Économie", language: LANGUAGE.FR },
		);

	it("returns the script and its sources", async () => {
		await expect(summarize(1)).resolves.toEqual({
			summary: SUMMARY,
			sources: SOURCES,
			usage: {
				promptTokens: ITERATION_USAGE.promptTokens * SUMMARY_ITERATIONS,
				completionTokens: ITERATION_USAGE.completionTokens * SUMMARY_ITERATIONS,
				totalTokens: ITERATION_USAGE.totalTokens * SUMMARY_ITERATIONS,
			},
		});
	});

	it("asks for a longer brief as the selection grows", async () => {
		await summarize(1);
		await summarize(3);

		const [one, three] = chatCalls().map((call) => call.messages[0].content);

		expect(one).toContain("about 320 words");
		expect(three).toContain("about 580 words");
	});

	it("caps the length of a busy day's brief", async () => {
		await summarize(10);

		expect(chatCalls()[0].messages[0].content).toContain("about 750 words");
	});

	it("leaves room to fetch every selected article one call at a time", async () => {
		await summarize(10);

		const { agentLoopStrategy } = chatCalls()[0];

		// The prompt asks for one getArticle call per article, and nothing
		// guarantees the model batches them: the loop must survive nine fetches
		// and still allow the tenth.
		expect(agentLoopStrategy?.({ toolCallCount: 9 })).toBe(true);
	});
});

describe("the getArticles tool", () => {
	const callTool = async (input: Record<string, unknown>) => {
		await service().makeSelection(42, TARGET_DATE, {
			name: "Économie",
			description: "L'économie française.",
		});

		const [tool] = chatCalls().filter(isSelectionCall)[0].tools;
		return tool.handler(input);
	};

	beforeEach(() => {
		getObservedArticles.mockResolvedValue([
			observedArticle(1),
			observedArticle(2, "provider-2"),
		]);
	});

	it("hands over the day's candidates, dates as strings", async () => {
		await expect(callTool({ day: "2026-08-17" })).resolves.toEqual([
			{
				id: "article-1",
				providerId: "provider-1",
				title: "Article 1",
				description: "Description 1",
				publishedAt: "2026-08-17T01:00:00.000Z",
			},
			{
				id: "article-2",
				providerId: "provider-2",
				title: "Article 2",
				description: "Description 2",
				publishedAt: "2026-08-17T02:00:00.000Z",
			},
		]);
	});

	it("narrows the candidates to the providers asked for", async () => {
		const articles = (await callTool({
			day: "2026-08-17",
			providerIds: ["provider-2"],
		})) as { id: string }[];

		expect(articles.map(({ id }) => id)).toEqual(["article-2"]);
	});

	it("keeps every candidate when the provider list comes back empty", async () => {
		const articles = (await callTool({
			day: "2026-08-17",
			providerIds: [],
		})) as { id: string }[];

		expect(articles).toHaveLength(2);
	});

	it("serves an article with no publication date", async () => {
		getObservedArticles.mockResolvedValue([
			{ ...observedArticle(1), publishedAt: null },
		]);

		await expect(callTool({ day: "2026-08-17" })).resolves.toEqual([
			expect.objectContaining({ publishedAt: null }),
		]);
	});
});

describe("the getArticle tool", () => {
	const callTool = async (input: Record<string, unknown>) => {
		await service().makeSummary(
			[
				{ id: "article-1", title: "Article 1", rank: 0 },
				{ id: "article-2", title: "Article 2", rank: 1 },
			],
			TARGET_DATE,
			{ name: "Économie", language: LANGUAGE.FR },
		);

		const [tool] = chatCalls().filter((call) => !isSelectionCall(call))[0]
			.tools;
		return tool.handler(input);
	};

	beforeEach(() => {
		getArticle.mockResolvedValue({
			id: "article-1",
			providerId: "provider-1",
			title: "Article 1",
			description: "Description 1",
			content: "Le corps de l'article.",
			url: "https://example.test/article-1",
			publishedAt: new Date("2026-08-17T01:00:00.000Z"),
		});
	});

	it("serves a ranked article, dates as strings", async () => {
		await expect(callTool({ id: "article-1" })).resolves.toEqual({
			id: "article-1",
			providerId: "provider-1",
			title: "Article 1",
			description: "Description 1",
			content: "Le corps de l'article.",
			url: "https://example.test/article-1",
			publishedAt: "2026-08-17T01:00:00.000Z",
		});
	});

	it("refuses an id outside the ranked selection without reading the table", async () => {
		await expect(callTool({ id: "article-99" })).resolves.toBeNull();
		expect(getArticle).not.toHaveBeenCalled();
	});

	it("reports a ranked article that has since disappeared", async () => {
		getArticle.mockResolvedValue(undefined);

		await expect(callTool({ id: "article-1" })).resolves.toBeNull();
	});
});
