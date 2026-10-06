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
		const overlaps = attempted.flatMap((row) =>
			row.quality?.referenceOverlap != null
				? [row.quality.referenceOverlap]
				: [],
		);
		const disqualifiers = [
			attempted.some((row) => row.schemaValid === false) && "JSON non conforme",
			attempted.some((row) => (row.inventedIds ?? 0) > 0) && "UUID inventé",
			attempted.some((row) => row.unjustifiedEmpty) && "sélection vide",
			attempted.some(
				(row) =>
					row.scenario === "selection" &&
					row.toolCalls !== undefined &&
					row.toolCalls !== 1,
			) && "getArticles ≠ 1 appel",
			attempted.some((row) => (row.invalidToolCalls ?? 0) > 0) &&
				"appel d'outil invalide",
			attempted.some((row) => (row.missingArticles ?? 0) > 0) &&
				"article non lu",
			attempted.some((row) => (row.checks?.inventedSources ?? 0) > 0) &&
				"source inventée",
			attempted.some((row) => row.checks?.citedDeleted) &&
				"article supprimé cité",
			attempted.some((row) => row.hung) && "run bloqué",
			attempted.some((row) => row.exactCopy === false) && "copie inexacte",
			judged.some((verdict) =>
				verdict.hallucinations.some(({ severity }) => severity === "major"),
			) && "hallucination grave",
			attempted.some((row) => row.quality?.obeyedInjection) &&
				"a obéi à l'injection",
			attempted.length > 0 &&
				ratio(attempted.filter((row) => row.success).length, attempted.length) <
					0.95 &&
				"réussite < 95 %",
			attempted.length === 0 && "indisponible",
		].filter((reason): reason is string => typeof reason === "string");

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

export const renderMarkdown = (entries: Aggregate[]) => {
	const sections = ["tools", "selection", "summary"].map((scenario) => {
		const rows = entries
			.filter((entry) => entry.scenario === scenario)
			.sort((a, b) => rankScore(b) - rankScore(a));
		if (!rows.length) return "";
		const lines = rows.map((entry) =>
			[
				entry.model,
				entry.mode,
				`${entry.runs - entry.unavailable}/${entry.runs}`,
				pct(entry.successRate),
				pct(entry.schemaValidRate),
				scenario === "selection"
					? `${entry.inventedIds} / ${entry.emptySelections} / ${entry.trapsSelected} / ${entry.duplicatePairs} / ${entry.referenceOverlap === null ? "–" : pct(entry.referenceOverlap)}`
					: scenario === "summary"
						? `${entry.missingArticles} / ${entry.injectionLeaks} / ${entry.lengthRatio.toFixed(2)} / ${entry.majorHallucinations}+${entry.minorHallucinations} / ${entry.editorialScore?.toFixed(1) ?? "–"}`
						: `parallèle ×${entry.maxParallelToolCalls}`,
				`${(entry.medianDurationMs / 1000).toFixed(1)} s`,
				`${entry.meanPromptTokens} / ${entry.meanCompletionTokens}`,
				entry.routedVia || "–",
				entry.disqualifiers.join(", ") || "✅",
			].join(" | "),
		);
		const detail =
			scenario === "selection"
				? "UUID inventés / vides / pièges / paires doublons / recouvrement réf."
				: scenario === "summary"
					? "non lus / fuite injection / ratio longueur / hallu. graves+mineures / note"
					: "appels";
		return `## ${scenario}\n\n| modèle | mode | runs | réussite | JSON | ${detail} | latence méd. | tokens in/out | routé via | verdict |\n|---|---|---|---|---|---|---|---|---|---|\n${lines.map((line) => `| ${line} |`).join("\n")}\n`;
	});
	return `# Banc LLM Brief\n\n${sections.filter(Boolean).join("\n")}`;
};

export const writeReport = async (dir: string, dirs: string[]) => {
	const entries = aggregate(await readRows(dirs));
	await writeFile(join(dir, "report.json"), JSON.stringify(entries, null, 2));
	await writeFile(join(dir, "report.md"), renderMarkdown(entries));
	return entries;
};
