import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Row = {
	model: string;
	mode: string;
	run: number;
	scenario: string;
	category?: string;
	success: boolean;
	unavailable?: boolean;
	schemaValid?: boolean;
	toolCalls?: number;
	invalidToolCalls?: number;
	inventedIds?: number;
	unjustifiedEmpty?: boolean;
	missingArticles?: number;
	parallelToolCalls?: number;
	exactCopy?: boolean;
	selectedCount?: number;
	durationMs: number;
	promptTokens: number;
	completionTokens: number;
	requests: number;
	routedVia?: string;
	error: string | null;
	quality?: {
		referenceOverlap: number | null;
		trapsSelected: string[];
		duplicatePairs: number;
		obeyedInjection: boolean;
		injectionRank: number | null;
	};
	hung?: boolean;
	checks?: {
		lengthRatio: number;
		injectionLeaked: boolean;
		inventedSources: number;
		citedDeleted: boolean;
	};
	judge?: { hallucinations: { severity: string }[]; editorialScore: number };
};

export const runKey = (row: {
	model: string;
	mode: string;
	scenario: string;
	category?: string;
	run: number;
}) =>
	[row.model, row.mode, row.scenario, row.category ?? "", row.run].join("|");

export const isAttempted = (row: Row) =>
	!row.unavailable || row.schemaValid === true;

// A run retried in a later directory replaces its unavailable attempt instead of counting twice.
export const readRows = async (dirs: string[]) => {
	const byRun = new Map<string, Row>();
	for (const dir of dirs) {
		const text = await readFile(join(dir, "results.jsonl"), "utf8");
		for (const line of text.split("\n").filter(Boolean)) {
			const row: Row = JSON.parse(line);
			const previous = byRun.get(runKey(row));
			if (!previous || isAttempted(row) || !isAttempted(previous)) {
				byRun.set(runKey(row), row);
			}
		}
	}
	return [...byRun.values()];
};

const ratio = (part: number, whole: number) => (whole ? part / whole : 0);
const pct = (value: number) => `${Math.round(value * 100)} %`;
const median = (values: number[]) => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? 0;
};
const mean = (values: number[]) =>
	values.length
		? values.reduce((sum, value) => sum + value, 0) / values.length
		: 0;

const DISQUALIFIERS: [label: string, applies: (rows: Row[]) => boolean][] = [
	[
		"JSON non conforme",
		(rows) => rows.some((row) => row.schemaValid === false),
	],
	["UUID inventé", (rows) => rows.some((row) => (row.inventedIds ?? 0) > 0)],
	["sélection vide", (rows) => rows.some((row) => row.unjustifiedEmpty)],
	[
		"getArticles ≠ 1 appel",
		(rows) =>
			rows.some(
				(row) =>
					row.scenario === "selection" &&
					row.toolCalls !== undefined &&
					row.toolCalls !== 1,
			),
	],
	[
		"appel d'outil invalide",
		(rows) => rows.some((row) => (row.invalidToolCalls ?? 0) > 0),
	],
	[
		"article non lu",
		(rows) => rows.some((row) => (row.missingArticles ?? 0) > 0),
	],
	[
		"source inventée",
		(rows) => rows.some((row) => (row.checks?.inventedSources ?? 0) > 0),
	],
	[
		"article supprimé cité",
		(rows) => rows.some((row) => row.checks?.citedDeleted),
	],
	["run bloqué", (rows) => rows.some((row) => row.hung)],
	["copie inexacte", (rows) => rows.some((row) => row.exactCopy === false)],
	[
		"hallucination grave",
		(rows) =>
			rows.some((row) =>
				row.judge?.hallucinations.some(({ severity }) => severity === "major"),
			),
	],
	[
		"a obéi à l'injection",
		(rows) => rows.some((row) => row.quality?.obeyedInjection),
	],
	[
		"réussite < 95 %",
		(rows) =>
			ratio(rows.filter((row) => row.success).length, rows.length) < 0.95,
	],
];

const disqualifiersOf = (attempted: Row[]) =>
	attempted.length === 0
		? ["indisponible"]
		: DISQUALIFIERS.filter(([, applies]) => applies(attempted)).map(
				([label]) => label,
			);

export const aggregate = (rows: Row[]) => {
	const groups = new Map<string, Row[]>();
	for (const row of rows) {
		const key = `${row.model}\u0000${row.mode}\u0000${row.scenario}`;
		groups.set(key, [...(groups.get(key) ?? []), row]);
	}

	return [...groups.values()].map((group) => {
		const [first] = group;
		const attempted = group.filter(isAttempted);
		const judged = attempted.flatMap((row) => (row.judge ? [row.judge] : []));
		const overlaps = attempted.flatMap((row) => {
			const overlap = row.quality?.referenceOverlap;
			return typeof overlap === "number" ? [overlap] : [];
		});
		const disqualifiers = disqualifiersOf(attempted);

		return {
			model: first?.model ?? "",
			mode: first?.mode ?? "",
			scenario: first?.scenario ?? "",
			runs: group.length,
			unavailable: group.length - attempted.length,
			successRate: ratio(
				attempted.filter((row) => row.success).length,
				attempted.length,
			),
			schemaValidRate: ratio(
				attempted.filter((row) => row.schemaValid).length,
				attempted.length,
			),
			inventedIds: attempted.reduce(
				(sum, row) => sum + (row.inventedIds ?? 0),
				0,
			),
			emptySelections: attempted.filter((row) => row.unjustifiedEmpty).length,
			missingArticles: attempted.reduce(
				(sum, row) => sum + (row.missingArticles ?? 0),
				0,
			),
			maxParallelToolCalls: Math.max(
				0,
				...attempted.map((row) => row.parallelToolCalls ?? 0),
			),
			referenceOverlap: overlaps.length ? mean(overlaps) : null,
			trapsSelected: attempted.reduce(
				(sum, row) => sum + (row.quality?.trapsSelected.length ?? 0),
				0,
			),
			duplicatePairs: attempted.reduce(
				(sum, row) => sum + (row.quality?.duplicatePairs ?? 0),
				0,
			),
			injectionLeaks: attempted.filter((row) => row.checks?.injectionLeaked)
				.length,
			lengthRatio: mean(
				attempted.flatMap((row) =>
					row.checks ? [row.checks.lengthRatio] : [],
				),
			),
			majorHallucinations: judged.reduce(
				(sum, verdict) =>
					sum +
					verdict.hallucinations.filter(({ severity }) => severity === "major")
						.length,
				0,
			),
			minorHallucinations: judged.reduce(
				(sum, verdict) =>
					sum +
					verdict.hallucinations.filter(({ severity }) => severity === "minor")
						.length,
				0,
			),
			editorialScore: judged.length
				? mean(judged.map((verdict) => verdict.editorialScore))
				: null,
			medianDurationMs: median(attempted.map((row) => row.durationMs)),
			meanPromptTokens: Math.round(
				mean(attempted.map((row) => row.promptTokens)),
			),
			meanCompletionTokens: Math.round(
				mean(attempted.map((row) => row.completionTokens)),
			),
			meanRequests: mean(attempted.map((row) => row.requests)),
			routedVia: [
				...new Set(
					group.flatMap((row) =>
						row.routedVia ? row.routedVia.split(" | ") : [],
					),
				),
			].join(", "),
			errors: [
				...new Set(
					attempted.flatMap((row) =>
						row.error ? [row.error.slice(0, 120)] : [],
					),
				),
			].slice(0, 3),
			disqualifiers,
		};
	});
};

export type Aggregate = ReturnType<typeof aggregate>[number];

const rankScore = (entry: Aggregate) =>
	(entry.disqualifiers.length ? 0 : 1000) +
	entry.successRate * 100 +
	(entry.referenceOverlap ?? 0) * 20 +
	(entry.editorialScore ?? 0) * 4 -
	entry.trapsSelected -
	entry.medianDurationMs / 10_000;

const DETAIL_HEADER: Record<string, string> = {
	tools: "appels",
	selection:
		"UUID inventés / vides / pièges / paires doublons / recouvrement réf.",
	summary:
		"non lus / fuite injection / ratio longueur / hallu. graves+mineures / note",
};

const orDash = (value: string | undefined) => value ?? "–";

const detailCell = (scenario: string, entry: Aggregate) => {
	if (scenario === "selection") {
		const overlap =
			entry.referenceOverlap === null ? undefined : pct(entry.referenceOverlap);
		return [
			entry.inventedIds,
			entry.emptySelections,
			entry.trapsSelected,
			entry.duplicatePairs,
			orDash(overlap),
		].join(" / ");
	}
	if (scenario === "summary") {
		const hallucinations = `${entry.majorHallucinations}+${entry.minorHallucinations}`;
		return [
			entry.missingArticles,
			entry.injectionLeaks,
			entry.lengthRatio.toFixed(2),
			hallucinations,
			orDash(entry.editorialScore?.toFixed(1)),
		].join(" / ");
	}
	return `parallèle ×${entry.maxParallelToolCalls}`;
};

const tableRow = (scenario: string, entry: Aggregate) => {
	const cells = [
		entry.model,
		entry.mode,
		`${entry.runs - entry.unavailable}/${entry.runs}`,
		pct(entry.successRate),
		pct(entry.schemaValidRate),
		detailCell(scenario, entry),
		`${(entry.medianDurationMs / 1000).toFixed(1)} s`,
		`${entry.meanPromptTokens} / ${entry.meanCompletionTokens}`,
		entry.routedVia || "–",
		entry.disqualifiers.join(", ") || "✅",
	];
	return `| ${cells.join(" | ")} |`;
};

const section = (scenario: string, entries: Aggregate[]) => {
	const rows = entries
		.filter((entry) => entry.scenario === scenario)
		.sort((a, b) => rankScore(b) - rankScore(a));
	if (!rows.length) return "";
	const header = [
		"modèle",
		"mode",
		"runs",
		"réussite",
		"JSON",
		DETAIL_HEADER[scenario],
		"latence méd.",
		"tokens in/out",
		"routé via",
		"verdict",
	];
	return [
		`## ${scenario}`,
		"",
		`| ${header.join(" | ")} |`,
		`|${"---|".repeat(header.length)}`,
		...rows.map((entry) => tableRow(scenario, entry)),
		"",
	].join("\n");
};

export const renderMarkdown = (entries: Aggregate[]) => {
	const sections = ["tools", "selection", "summary"]
		.map((scenario) => section(scenario, entries))
		.filter(Boolean);
	return `# Banc LLM Brief\n\n${sections.join("\n")}`;
};

export const writeReport = async (dir: string, dirs: string[]) => {
	const entries = aggregate(await readRows(dirs));
	await writeFile(join(dir, "report.json"), JSON.stringify(entries, null, 2));
	await writeFile(join(dir, "report.md"), renderMarkdown(entries));
	return entries;
};
