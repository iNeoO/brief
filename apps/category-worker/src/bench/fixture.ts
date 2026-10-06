import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { LANGUAGE } from "@brief/common/constants";
import { z } from "zod";

export const FIXTURE_PATH = fileURLToPath(
	new URL("../../bench/llm-fixture.json", import.meta.url),
);

export const TRAP = {
	DUPLICATE: "duplicate",
	SPONSORED: "sponsored",
	HOROSCOPE: "horoscope",
	VAGUE: "vague",
	INJECTION: "injection",
	UNUSABLE_CONTENT: "unusable_content",
	DELETED: "deleted",
} as const;

export const INJECTION_SENTINEL = "ACME";

const rankedIdSchema = z.object({ id: z.string(), rank: z.number().int() });

const articleSchema = z.object({
	id: z.uuid(),
	providerId: z.uuid(),
	title: z.string(),
	description: z.string().nullable(),
	content: z.string(),
	url: z.string(),
	publishedAt: z.iso.datetime().nullable(),
	trap: z.enum(TRAP).optional(),
	duplicateOf: z.uuid().optional(),
	offTopicSource: z.boolean().optional(),
});

const categorySchema = z.object({
	key: z.string(),
	name: z.string(),
	description: z.string(),
	language: z.enum(LANGUAGE),
	providers: z.array(
		z.object({
			id: z.uuid(),
			slug: z.string(),
			name: z.string(),
			offTopic: z.boolean(),
		}),
	),
	articles: z.array(articleSchema),
	reference: z
		.object({ model: z.string(), selection: z.array(rankedIdSchema) })
		.optional(),
	summarySet: z.array(rankedIdSchema).optional(),
});

export const fixtureSchema = z.object({
	version: z.literal(1),
	builtAt: z.iso.datetime(),
	targetDate: z.iso.date(),
	categories: z.array(categorySchema),
});

export type Fixture = z.infer<typeof fixtureSchema>;
export type FixtureCategory = z.infer<typeof categorySchema>;
export type FixtureArticle = z.infer<typeof articleSchema>;
export type RankedId = z.infer<typeof rankedIdSchema>;

export const loadFixture = async (): Promise<Fixture> =>
	fixtureSchema.parse(JSON.parse(await readFile(FIXTURE_PATH, "utf8")));

export const saveFixture = async (fixture: Fixture) =>
	writeFile(
		FIXTURE_PATH,
		`${JSON.stringify(fixtureSchema.parse(fixture), null, "\t")}\n`,
	);

export const pickCategories = (fixture: Fixture, keys: string[] | undefined) =>
	keys?.length
		? fixture.categories.filter((category) => keys.includes(category.key))
		: fixture.categories;
