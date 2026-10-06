import { appendFile, mkdir } from "node:fs/promises";
import { basename, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { LLM_PROVIDER } from "@brief/common/constants";
import { createTextAdapter } from "@brief/services";
import { OPENAI_TEXT_MODELS } from "@brief/services/llm";
import { z } from "zod";
import { createCapture, type Exchange } from "../bench/capture.js";
import {
	type FixtureCategory,
	loadFixture,
	pickCategories,
	saveFixture,
	TRAP,
} from "../bench/fixture.js";
import { judgeSummary } from "../bench/judge.js";
import {
	isAttempted,
	readRows,
	renderMarkdown,
	runKey,
	writeReport,
} from "../bench/report.js";
import {
	articlesFrom,
	processingFor,
	type RunContext,
	type RunResult,
	runSelection,
	runSummary,
	runToolsProbe,
	SCENARIO,
	type Scenario,
} from "../bench/scenarios.js";

const RESULTS_DIR = fileURLToPath(
	new URL("../../bench/results", import.meta.url),
);
const MIN_PAUSE_MS = 20_000;
const MAX_PAUSE_MS = 300_000;
const MAX_UNAVAILABLE_STREAK = 4;

// chat() can stay unsettled after its abort; past this, the run is recorded as hung.
const WATCHDOG_MS: Record<Scenario, number> = {
	[SCENARIO.TOOLS]: 300_000,
	[SCENARIO.SELECTION]: 420_000,
	[SCENARIO.SUMMARY]: 720_000,
};

// FreeLLMAPI announces when its cooldown ends ("Soonest reset ~70s" / "~10m").
const ANNOUNCED_RESET = /reset ~(\d+)([sm])/;

const pauseFor = (result: BenchResult) => {
	const trail = `${result.error ?? ""} ${result.upstreamErrors.join(" ")}`;
	const match = ANNOUNCED_RESET.exec(trail);
	if (!match) return MIN_PAUSE_MS;
	const unitMs = match[2] === "m" ? 60_000 : 1_000;
	const announced = Number(match[1]) * unitMs + 5_000;
	return Math.min(Math.max(announced, MIN_PAUSE_MS), MAX_PAUSE_MS);
};

const MODE = { TWO_PHASE: "two-phase", COMBINED: "combined" } as const;
type Mode = (typeof MODE)[keyof typeof MODE];

const COMMANDS = {
	tools: [SCENARIO.TOOLS],
	selection: [SCENARIO.SELECTION],
	summary: [SCENARIO.SUMMARY],
	benchmark: [SCENARIO.SELECTION, SCENARIO.SUMMARY],
} satisfies Record<string, Scenario[]>;

const { positionals, values } = parseArgs({
	allowPositionals: true,
	options: {
		models: { type: "string" },
		runs: { type: "string" },
		categories: { type: "string" },
		mode: { type: "string", default: MODE.TWO_PHASE },
		concurrency: { type: "string", default: "3" },
		budget: { type: "string", default: "150" },
		judge: { type: "boolean", default: false },
		from: { type: "string", multiple: true },
		"skip-from": { type: "string", multiple: true },
	},
});

const command = positionals[0];
const baseUrl = process.env.FREE_LLM_API_URL ?? "";
const apiKey = process.env.FREE_LLM_API_KEY ?? "";

const positiveInt = z.coerce.number().int().positive();
const options = z
	.object({
		budget: positiveInt,
		concurrency: positiveInt,
		runs: positiveInt.optional(),
		mode: z.enum([MODE.TWO_PHASE, MODE.COMBINED, "both"]),
	})
	.parse(values);
const budget = { remaining: options.budget };

const csv = (value: string | undefined) =>
	value
		?.split(",")
		.map((item) => item.trim())
		.filter(Boolean);

const modesOf = (value: typeof options.mode): Mode[] =>
	value === "both" ? [MODE.TWO_PHASE, MODE.COMBINED] : [value];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveDirs = (dirs: string[] | undefined) =>
	(dirs ?? []).map((dir) =>
		isAbsolute(dir) ? dir : join(RESULTS_DIR, basename(dir)),
	);

const OPENAI_PREFIX = "openai/";

// `openai/<model>` goes through the production OpenAI adapter, so its mode is the
// adapter's own and --mode has no effect on it.
const adapterFor = (
	model: string,
	mode: Mode,
	fetch: typeof globalThis.fetch,
) => {
	if (!model.startsWith(OPENAI_PREFIX)) {
		return createTextAdapter({
			provider: LLM_PROVIDER.FREELLMAPI,
			freeLlm: {
				baseUrl,
				apiKey,
				model,
				combinedToolsAndSchema: mode === MODE.COMBINED,
				fetch,
				maxRetries: 0,
			},
		});
	}
	const openAiModel = z
		.enum(OPENAI_TEXT_MODELS)
		.parse(model.slice(OPENAI_PREFIX.length));
	return createTextAdapter({
		provider: LLM_PROVIDER.OPENAI,
		openai: { model: openAiModel, fetch },
	});
};

const contextFor = (
	model: string,
	mode: Mode,
	live: (exchange: Exchange) => void,
): RunContext => {
	const capture = createCapture(budget, live);
	return {
		adapter: adapterFor(model, mode, capture.fetch),
		exchanges: capture.exchanges,
		settle: capture.settle,
		abort: capture.abort,
	};
};

const INCAPABLE =
	/lacks tool-calling|format_ignored|not in the catalog|model_not_found|not found or removed/i;
const SATURATED =
	/rate.?limit|exhausted|cooldown|upstream_error|\b429\b|budget/i;

// A quota says nothing about what the model can do; an empty or refused answer does.
const isUnavailable = (result: BenchResult) => {
	if (result.success || result.schemaValid) return false;
	const trail = `${result.error ?? ""} ${result.upstreamErrors.join(" ")}`;
	return !INCAPABLE.test(trail) && SATURATED.test(trail);
};

const runScenario = (
	scenario: Scenario,
	context: RunContext,
	category: FixtureCategory | undefined,
	targetDate: Date,
) => {
	if (scenario === SCENARIO.TOOLS) return runToolsProbe(context);
	if (!category) throw new Error(`${scenario} needs a category`);
	return scenario === SCENARIO.SELECTION
		? runSelection(context, category, targetDate)
		: runSummary(context, category, targetDate);
};

const hung = (
	scenario: Scenario,
	context: RunContext,
	category?: FixtureCategory,
) => ({
	scenario,
	category: category?.name,
	success: false,
	schemaValid: false,
	hung: true,
	durationMs: WATCHDOG_MS[scenario],
	error: `hung: chat() did not settle within ${WATCHDOG_MS[scenario]} ms`,
	requests: context.exchanges.length,
	routedVia: "",
	promptTokens: 0,
	completionTokens: 0,
	upstreamErrors: context.exchanges.flatMap((exchange) =>
		exchange.error ? [exchange.error.slice(0, 200)] : [],
	),
	rateLimited: false,
});

type BenchResult = RunResult | ReturnType<typeof hung>;

const runOnce = (
	scenario: Scenario,
	context: RunContext,
	category: FixtureCategory | undefined,
	targetDate: Date,
): Promise<BenchResult> => {
	let timer: NodeJS.Timeout | undefined;
	const watchdog = new Promise<BenchResult>((resolve) => {
		timer = setTimeout(() => {
			context.abort();
			resolve(hung(scenario, context, category));
		}, WATCHDOG_MS[scenario]);
	});
	return Promise.race([
		runScenario(scenario, context, category, targetDate),
		watchdog,
	]).finally(() => clearTimeout(timer));
};

const pool = async <T>(
	items: T[],
	size: number,
	work: (item: T) => Promise<void>,
) => {
	const queue = [...items];
	await Promise.all(
		Array.from({ length: Math.max(1, size) }, async () => {
			for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
				await work(item);
			}
		}),
	);
};

type Slot = {
	model: string;
	mode: Mode;
	scenario: Scenario;
	category?: FixtureCategory;
	run: number;
};

type Session = { dir: string; targetDate: Date; done: Set<string> };

const errorText = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

const resultsDir = (suffix: string) =>
	join(
		RESULTS_DIR,
		`${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${suffix}`,
	);

const liveLog = (dir: string, model: string) => (exchange: Exchange) =>
	appendFile(
		join(dir, "live.jsonl"),
		`${JSON.stringify({ at: new Date().toISOString(), model, status: exchange.status, toolCalls: exchange.toolCalls.length, error: exchange.error?.slice(0, 160) ?? null, durationMs: exchange.durationMs })}\n`,
	).catch((error: unknown) => console.error("live log write failed", error));

const runWithRetry = async (slot: Slot, session: Session) => {
	const attempt = async () => {
		const context = contextFor(
			slot.model,
			slot.mode,
			liveLog(session.dir, slot.model),
		);
		const result = await runOnce(
			slot.scenario,
			context,
			slot.category,
			session.targetDate,
		);
		return { context, result };
	};

	const first = await attempt();
	if (!isUnavailable(first.result) || budget.remaining <= 0) return first;
	await sleep(pauseFor(first.result));
	return attempt();
};

const judgeIfAsked = async (
	category: FixtureCategory | undefined,
	result: BenchResult,
) => {
	if (!values.judge || !category || !("summary" in result) || !result.summary) {
		return {};
	}
	try {
		return { judge: await judgeSummary(category, result.summary) };
	} catch (error) {
		return { judgeError: errorText(error) };
	}
};

const statusMark = (result: BenchResult, unavailable: boolean) => {
	if (result.success) return "✔";
	return unavailable ? "…" : "✘";
};

const describeRun = (slot: Slot, result: BenchResult, unavailable: boolean) => {
	const target = slot.category ? ` ${slot.category.name}` : "";
	const failure = result.error ? ` — ${result.error.slice(0, 140)}` : "";
	return `${statusMark(result, unavailable)} ${slot.model} [${slot.mode}] ${slot.scenario}${target} #${slot.run} — ${result.durationMs} ms${failure}`;
};

const recordRun = async (slot: Slot, session: Session) => {
	const { context, result } = await runWithRetry(slot, session);
	const unavailable = isUnavailable(result);
	const { model, mode, run, scenario } = slot;
	const category = slot.category?.name;

	const row = {
		model,
		mode,
		run,
		unavailable,
		...result,
		...(await judgeIfAsked(slot.category, result)),
	};
	await appendFile(
		join(session.dir, "results.jsonl"),
		`${JSON.stringify(row)}\n`,
	);
	await appendFile(
		join(session.dir, "exchanges.jsonl"),
		`${JSON.stringify({ model, mode, run, scenario, category, exchanges: context.exchanges })}\n`,
	);
	console.log(describeRun(slot, result, unavailable));
	return unavailable;
};

const slotsFor = (
	model: string,
	mode: Mode,
	scenarios: Scenario[],
	categories: FixtureCategory[],
	runs: number,
): Slot[] =>
	scenarios.flatMap((scenario) => {
		const targets = scenario === SCENARIO.TOOLS ? [undefined] : categories;
		return Array.from({ length: runs }, (_, index) => index + 1).flatMap(
			(run) =>
				targets.map((category) => ({ model, mode, scenario, category, run })),
		);
	});

const runModel = async (slots: Slot[], session: Session) => {
	let unavailableStreak = 0;
	for (const slot of slots) {
		if (budget.remaining <= 0 || unavailableStreak >= MAX_UNAVAILABLE_STREAK) {
			return;
		}
		if (session.done.has(runKey({ ...slot, category: slot.category?.name }))) {
			continue;
		}
		const unavailable = await recordRun(slot, session);
		unavailableStreak = unavailable ? unavailableStreak + 1 : 0;
	}
};

const assertBenchable = (models: string[]) => {
	if (!models.length) throw new Error("--models is required (comma-separated)");
	if (!baseUrl || !apiKey) {
		throw new Error("FREE_LLM_API_URL and FREE_LLM_API_KEY must be set");
	}
	if (models.includes("auto")) {
		throw new Error(
			"Benchmark explicit models only: `auto` hides which model answered",
		);
	}
};

const bench = async (name: string, scenarios: Scenario[]) => {
	const models = csv(values.models) ?? [];
	assertBenchable(models);

	const fixture = await loadFixture();
	const categories = pickCategories(fixture, csv(values.categories));
	const runs = options.runs ?? (scenarios[0] === SCENARIO.TOOLS ? 1 : 5);

	const dir = resultsDir(name);
	await mkdir(dir, { recursive: true });
	console.log(`Results → ${dir} (budget ${budget.remaining} requests)`);

	const skipDirs = resolveDirs(values["skip-from"]);
	const session: Session = {
		dir,
		targetDate: new Date(fixture.targetDate),
		done: new Set((await readRows(skipDirs)).filter(isAttempted).map(runKey)),
	};

	const jobs = models.flatMap((model) =>
		modesOf(options.mode).map((mode) =>
			slotsFor(model, mode, scenarios, categories, runs),
		),
	);
	await pool(jobs, options.concurrency, (slots) => runModel(slots, session));

	const entries = await writeReport(dir, [dir, ...skipDirs]);
	console.log(`\n${renderMarkdown(entries)}`);
	console.log(`Budget left: ${budget.remaining} requests`);
};

// Every model then writes its summary from the same articles, whatever it would have picked itself.
const reference = async () => {
	const fixture = await loadFixture();
	const targetDate = new Date(fixture.targetDate);
	const adapter = createTextAdapter({ provider: LLM_PROVIDER.OPENAI });

	for (const category of fixture.categories) {
		category.articles = category.articles.map(({ trap, ...article }) =>
			trap === TRAP.DELETED ? article : { ...article, trap },
		);
		const byId = new Map(
			category.articles.map((article) => [article.id, article]),
		);
		const service = processingFor(adapter, articlesFrom(category));
		const { articles } = await service.makeSelection(0, targetDate, category);
		category.reference = {
			model: "gpt-5.5",
			selection: articles.map(({ id, rank }) => ({ id, rank })),
		};

		const plain = articles.filter(({ id }) => !byId.get(id)?.trap).slice(0, 6);
		const deleted = plain[5];
		const trapOf = (trap: string) =>
			category.articles.find((article) => article.trap === trap);
		const injection = trapOf(TRAP.INJECTION);
		const unusable = trapOf(TRAP.UNUSABLE_CONTENT);
		const ordered = [
			plain[0],
			plain[1],
			injection,
			plain[2],
			unusable,
			plain[3],
			deleted,
			plain[4],
		].filter((article) => article !== undefined);
		category.summarySet = ordered.map(({ id }, rank) => ({ id, rank }));
		if (deleted) {
			category.articles = category.articles.map((article) =>
				article.id === deleted.id
					? { ...article, trap: TRAP.DELETED }
					: article,
			);
		}

		console.log(
			`${category.name}: gpt-5.5 kept ${articles.length}; summary set of ${category.summarySet.length}`,
		);
		for (const { rank, title } of articles) console.log(`  ${rank}. ${title}`);
	}

	await saveFixture(fixture);
};

const main = async () => {
	if (command === "reference") return reference();
	if (command === "report") {
		const dirs = resolveDirs(values.from);
		if (!dirs.length) throw new Error("--from <results dir> (repeatable)");
		const dir = resultsDir("report");
		await mkdir(dir, { recursive: true });
		const entries = await writeReport(dir, dirs);
		console.log(renderMarkdown(entries));
		return;
	}
	if (command && command in COMMANDS) {
		return bench(command, COMMANDS[command as keyof typeof COMMANDS]);
	}
	throw new Error(
		`Usage: llmBench <tools|selection|summary|benchmark|reference|report> --models a,b [--runs 5] [--categories france,afrique,ue] [--mode two-phase|combined|both] [--budget 150] [--concurrency 3] [--judge]`,
	);
};

try {
	await main();
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
