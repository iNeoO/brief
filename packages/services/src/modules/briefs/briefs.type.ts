import type { Language } from "@brief/common/types";

/** One brief in a list: everything a card shows, and nothing more. */
export type BriefCard = {
	id: number;
	categoryId: string;
	categoryName: string;
	language: Language;
	targetDate: Date;
	publishedAt: Date;
	/** First sentences of the script, cut on a word boundary. */
	excerpt: string;
	readingMinutes: number;
	/** Null when the audio step never produced a file for this brief. */
	audioFileId: string | null;
};

/** An article the brief was written from, in the order the script covers it. */
export type BriefSource = {
	rank: number;
	title: string;
	url: string;
	providerName: string;
	publishedAt: Date | null;
};

/** One story of the script, with the article it was written from. */
export type BriefStory = {
	paragraph: string;
	/** Null when the paragraphs and the sources could not be lined up. */
	source: BriefSource | null;
};

/**
 * The script broken into the parts the writing prompt guarantees: an opening
 * sentence, a paragraph running through the headlines, one paragraph per
 * story, and a closing sentence.
 */
export type BriefScript = {
	opening: string | null;
	/** Absent by design when the brief covers a single story. */
	headlines: string | null;
	stories: BriefStory[];
	closing: string | null;
	/** True when every story paragraph found its source. */
	aligned: boolean;
};

export type BriefDetail = Omit<BriefCard, "excerpt"> & {
	categoryDescription: string;
	script: BriefScript;
	audio: {
		id: string;
		filename: string;
		mimeType: string;
		size: number;
	} | null;
	sources: BriefSource[];
};

export type ListBriefsInput = {
	page?: number;
	pageSize?: number;
};
