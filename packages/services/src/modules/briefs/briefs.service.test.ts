import {
	BRIEFS_PAGE_SIZE,
	CATEGORY_JOB_STATUS,
	FILE_KIND,
	LANGUAGE,
	SITEMAP_MAX_BRIEFS,
} from "@brief/common/constants";
import { and, asc, desc, eq, isNotNull, schema } from "@brief/drizzle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDatabase, recordingChain } from "../../testing/db.fake.js";
import { BriefsService } from "./briefs.service.js";

const BRIEF_ID = 101;
const CATEGORY_ID = "category-1";
const USER_ID = "user-1";
const TARGET_DATE = new Date("2026-08-17T00:00:00.000Z");
const PUBLISHED_AT = new Date("2026-08-17T06:12:00.000Z");

/** The predicate every read shares: finished, and with a script to show. */
const isPublished = and(
	eq(schema.categoryJobs.status, CATEGORY_JOB_STATUS.FINISHED),
	isNotNull(schema.categoryJobs.summary),
);

const SUMMARY = [
	"Voici les titres de ce mercredi.",
	"Au sommaire : la réforme, puis le budget.",
	"La réforme a été adoptée hier soir.",
	"Le budget, lui, attend encore.",
	"C'était votre brief.",
].join("\n\n");

type CardRow = {
	id: number;
	categoryId: string;
	categoryName: string;
	language: string;
	targetDate: Date;
	publishedAt: Date | null;
	summary: string | null;
	audioFileId: string | null;
};

const cardRow = (overrides: Partial<CardRow> = {}) =>
	({
		id: BRIEF_ID,
		categoryId: CATEGORY_ID,
		categoryName: "Actu France",
		language: LANGUAGE.FR,
		targetDate: TARGET_DATE,
		publishedAt: PUBLISHED_AT,
		summary: SUMMARY,
		audioFileId: "file-1",
		...overrides,
	}) as CardRow;

type Rows = {
	/** The card or detail rows, read from `category_jobs`. */
	briefs?: Record<string, unknown>[];
	/** The matching count, as the second query of a page answers it. */
	total?: { total: number }[];
	/** The ranked articles behind one brief. */
	sources?: Record<string, unknown>[];
	/** The audio file row, read from `files`. */
	audio?: Record<string, unknown>[];
};

/**
 * Reads are told apart by the columns they ask for — only a count selects
 * `total` — and otherwise by the table they select from.
 */
const harness = (rows: Rows = {}) => {
	const briefs = recordingChain(rows.briefs ?? []);
	const totals = recordingChain(rows.total ?? [{ total: 0 }]);
	const sources = recordingChain(rows.sources ?? []);
	const audio = recordingChain(rows.audio ?? []);

	const select = (columns: Record<string, unknown> = {}) => ({
		from: (table: unknown) => {
			if ("total" in columns) return totals;
			if (table === schema.files) return audio;
			if (table === schema.categoryJobArticles) return sources;
			return briefs;
		},
	});

	return {
		briefs,
		totals,
		sources,
		audio,
		service: new BriefsService(asDatabase({ select })),
	};
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("listLatest", () => {
	it("turns a row into the card the home page draws", async () => {
		const { service } = harness({ briefs: [cardRow()] });

		await expect(service.listLatest(3)).resolves.toEqual([
			{
				id: BRIEF_ID,
				categoryId: CATEGORY_ID,
				categoryName: "Actu France",
				language: LANGUAGE.FR,
				targetDate: TARGET_DATE,
				publishedAt: PUBLISHED_AT,
				excerpt: expect.stringContaining("Voici les titres"),
				readingMinutes: 1,
				audioFileId: "file-1",
			},
		]);
	});

	it("falls back to the target date when the job carries no finish time", async () => {
		// A card without a date would sort and read as if it had never been
		// published; the day the brief covers is the honest stand-in.
		const { service } = harness({
			briefs: [cardRow({ publishedAt: null })],
		});

		await expect(service.listLatest(1)).resolves.toMatchObject([
			{ publishedAt: TARGET_DATE },
		]);
	});

	it("survives a published job whose script is missing", async () => {
		// The `is not null` guard makes it unreachable, but the card must not
		// crash on it: an empty excerpt is still a card.
		const { service } = harness({ briefs: [cardRow({ summary: null })] });

		await expect(service.listLatest(1)).resolves.toMatchObject([
			{ excerpt: "", readingMinutes: 1 },
		]);
	});

	it("reads only published briefs, newest first, and joins the audio", async () => {
		const { service, briefs } = harness();

		await service.listLatest(5);

		expect(briefs.args("where")).toEqual([isPublished]);
		expect(briefs.args("orderBy")).toEqual([
			desc(schema.categoryJobs.targetDate),
			desc(schema.categoryJobs.id),
		]);
		// Left join: a brief whose audio never landed still has a card.
		expect(briefs.args("leftJoin")).toEqual([
			schema.files,
			and(
				eq(schema.files.categoryJobId, schema.categoryJobs.id),
				eq(schema.files.kind, FILE_KIND.AUDIO_FILE),
				eq(schema.files.language, schema.categories.language),
			),
		]);
		expect(briefs.args("limit")).toEqual([5]);
	});
});

describe("list", () => {
	it("pages the briefs and reports the total", async () => {
		const { service, briefs } = harness({
			briefs: [cardRow()],
			total: [{ total: 25 }],
		});

		await expect(service.list({ page: 2 })).resolves.toMatchObject({
			total: 25,
			page: 2,
			pageSize: BRIEFS_PAGE_SIZE,
			pageCount: 3,
		});

		expect(briefs.args("limit")).toEqual([BRIEFS_PAGE_SIZE]);
		expect(briefs.args("offset")).toEqual([BRIEFS_PAGE_SIZE]);
	});

	it("reads the first page when the caller asks for nothing", async () => {
		const { service } = harness();

		await expect(service.list()).resolves.toMatchObject({
			items: [],
			total: 0,
			page: 1,
			// An empty list still reads as "page 1 of 1".
			pageCount: 1,
		});
	});

	it("counts nothing when the count query comes back empty", async () => {
		const { service } = harness({ briefs: [], total: [] });

		await expect(service.list()).resolves.toMatchObject({
			total: 0,
			pageCount: 1,
		});
	});

	it("counts only what it lists", async () => {
		const { service, totals } = harness();

		await service.list();

		expect(totals.args("where")).toEqual([isPublished]);
	});
});

describe("listSubscribed", () => {
	it("keeps the reader's own topics only, and counts the same set", async () => {
		const { service, briefs, totals } = harness({ briefs: [cardRow()] });

		await service.listSubscribed({ userId: USER_ID, page: 1 });

		const [where] = briefs.args("where") ?? [];
		expect(where).not.toEqual(isPublished);
		expect(totals.args("where")).toEqual([where]);
	});
});

describe("listSitemapEntries", () => {
	it("dates every entry, falling back to the target date", async () => {
		const { service } = harness({
			briefs: [
				{ id: BRIEF_ID, targetDate: TARGET_DATE, publishedAt: PUBLISHED_AT },
				{ id: 102, targetDate: TARGET_DATE, publishedAt: null },
			],
		});

		await expect(service.listSitemapEntries()).resolves.toEqual([
			{ id: BRIEF_ID, updatedAt: PUBLISHED_AT },
			{ id: 102, updatedAt: TARGET_DATE },
		]);
	});

	it("caps the sitemap at what the format allows", async () => {
		const { service, briefs } = harness();

		await service.listSitemapEntries();

		expect(briefs.args("limit")).toEqual([SITEMAP_MAX_BRIEFS]);
	});

	it("takes a tighter cap from the caller", async () => {
		const { service, briefs } = harness();

		await service.listSitemapEntries(10);

		expect(briefs.args("limit")).toEqual([10]);
	});
});

describe("findPublishedAudio", () => {
	it("finds the audio of a published brief", async () => {
		const row = {
			id: "file-1",
			mimeType: "audio/mpeg",
			categoryName: "Actu France",
			targetDate: TARGET_DATE,
		};
		const { service, audio } = harness({ audio: [row] });

		await expect(service.findPublishedAudio("file-1")).resolves.toBe(row);

		// Only an audio file, and only one belonging to a published brief: this
		// endpoint is public.
		expect(audio.args("where")).toEqual([
			and(
				isPublished,
				eq(schema.files.id, "file-1"),
				eq(schema.files.kind, FILE_KIND.AUDIO_FILE),
			),
		]);
	});

	it("returns null when no such file is published", async () => {
		const { service } = harness({ audio: [] });

		await expect(service.findPublishedAudio("ghost")).resolves.toBeNull();
	});
});

describe("getById", () => {
	const detailRow = (overrides: Record<string, unknown> = {}) => ({
		...cardRow(),
		categoryDescription: "Le fil français",
		sourceLines: [
			"1. La réforme adoptée — https://example.test/reforme",
			"2. Le budget en attente — https://example.test/budget",
		].join("\n"),
		audioFilename: "actu-france-2026-08-17.mp3",
		audioMimeType: "audio/mpeg",
		audioSize: 2_048,
		...overrides,
	});

	const source = (rank: number, url: string) => ({
		rank,
		title: `Titre ${rank}`,
		url,
		providerName: "France Info",
		publishedAt: TARGET_DATE,
	});

	const sources = [
		source(1, "https://example.test/reforme"),
		source(2, "https://example.test/budget"),
	];

	it("returns the brief with its script, its audio and its sources", async () => {
		const { service } = harness({ briefs: [detailRow()], sources });

		const brief = await service.getById(BRIEF_ID);

		expect(brief).toMatchObject({
			id: BRIEF_ID,
			categoryDescription: "Le fil français",
			audio: {
				id: "file-1",
				filename: "actu-france-2026-08-17.mp3",
				mimeType: "audio/mpeg",
				size: 2_048,
			},
			sources,
		});
		// The card's excerpt is a teaser for a list, not for the page itself.
		expect(brief).not.toHaveProperty("excerpt");
	});

	it("pairs each story with the article behind it", async () => {
		const { service } = harness({ briefs: [detailRow()], sources });

		const brief = await service.getById(BRIEF_ID);

		expect(brief?.script.aligned).toBe(true);
		expect(brief?.script.stories.map(({ source }) => source?.url)).toEqual([
			"https://example.test/reforme",
			"https://example.test/budget",
		]);
	});

	it("drops a source line pointing at an article it never selected", async () => {
		// The lines come from the model: one that invented a url must not become a
		// story's source, and the misalignment is what stops the attribution.
		const { service } = harness({
			briefs: [
				detailRow({
					sourceLines: [
						"1. La réforme adoptée — https://example.test/reforme",
						"2. Un article inventé — https://example.test/invente",
					].join("\n"),
				}),
			],
			sources,
		});

		const brief = await service.getById(BRIEF_ID);

		expect(brief?.script.aligned).toBe(false);
		expect(brief?.script.stories.every(({ source }) => source === null)).toBe(
			true,
		);
	});

	it("reports no audio when the file row is only half there", async () => {
		const { service } = harness({
			briefs: [detailRow({ audioMimeType: null })],
			sources,
		});

		await expect(service.getById(BRIEF_ID)).resolves.toMatchObject({
			audio: null,
		});
	});

	it("reports a zero size when the file row has none", async () => {
		const { service } = harness({
			briefs: [detailRow({ audioSize: null })],
			sources,
		});

		await expect(service.getById(BRIEF_ID)).resolves.toMatchObject({
			audio: { size: 0 },
		});
	});

	it("renders a brief whose script is missing as an empty one", async () => {
		const { service } = harness({
			briefs: [detailRow({ summary: null })],
			sources,
		});

		const brief = await service.getById(BRIEF_ID);

		expect(brief?.script.stories).toEqual([]);
		expect(brief?.script.aligned).toBe(false);
	});

	it("reads the sources of that brief in rank order", async () => {
		const { service, sources: sourcesChain } = harness({
			briefs: [detailRow()],
			sources,
		});

		await service.getById(BRIEF_ID);

		expect(sourcesChain.args("where")).toEqual([
			eq(schema.categoryJobArticles.categoryJobId, BRIEF_ID),
		]);
		expect(sourcesChain.args("orderBy")).toEqual([
			asc(schema.categoryJobArticles.rank),
		]);
	});

	it("returns null for a brief that is not published", async () => {
		const { service, briefs, sources: sourcesChain } = harness({ briefs: [] });

		await expect(service.getById(BRIEF_ID)).resolves.toBeNull();

		expect(briefs.args("where")).toEqual([
			and(isPublished, eq(schema.categoryJobs.id, BRIEF_ID)),
		]);
		// No point reading the sources of a brief nobody may open.
		expect(sourcesChain.calls).toEqual([]);
	});
});
