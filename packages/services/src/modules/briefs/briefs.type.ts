import type { Language } from "@brief/common/types";

export type BriefCard = {
	id: number;
	categoryId: string;
	categoryName: string;
	language: Language;
	targetDate: Date;
	publishedAt: Date;
	excerpt: string;
	readingMinutes: number;
	audioFileId: string | null;
};

export type BriefSource = {
	rank: number;
	title: string;
	url: string;
	providerName: string;
	publishedAt: Date | null;
};

export type BriefStory = {
	paragraph: string;
	source: BriefSource | null;
};

export type BriefScript = {
	opening: string | null;
	headlines: string | null;
	stories: BriefStory[];
	closing: string | null;
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

export type BriefSitemapEntry = {
	id: number;
	updatedAt: Date;
};

export type ListBriefsInput = {
	page?: number;
	pageSize?: number;
};

export type ListSubscribedBriefsInput = ListBriefsInput & { userId: string };
