/** A calendar day as `YYYY-MM-DD`, in UTC — the pipeline's own notion of a day. */
export type DayKey = string;

/** The days the admin home covers, oldest first, with the instant it opens on. */
export type StatsWindow = {
	since: Date;
	dayKeys: DayKey[];
};

/**
 * What the vendors charge, per million units. Each half is optional: a
 * deployment that has not filled the grid in gets no estimate rather than a
 * wrong one.
 */
export type AdminStatsPricing = {
	llm?: {
		promptPerMillionTokens: number;
		completionPerMillionTokens: number;
	};
	tts?: {
		perMillionCharacters: number;
	};
};

/** What the window's usage cost, or null wherever the grid is not filled in. */
export type AdminStatsCost = {
	llm: number | null;
	tts: number | null;
	/** Both halves, or null as soon as one is unknown: a partial total misleads. */
	total: number | null;
	currency: string;
};

export type AdminStatsUsage = {
	promptTokens: number;
	completionTokens: number;
	/** Characters of brief text sent to the speech API. */
	ttsCharacters: number;
};

export type AdminStatsOverview = {
	windowDays: number;
	since: DayKey;
	users: {
		total: number;
		emailVerified: number;
		/** Readers who can actually receive a brief. */
		telegramPaired: number;
		/** Readers following at least one topic. */
		subscribed: number;
		newInWindow: number;
	};
	window: AdminStatsUsage & {
		briefsProduced: number;
		deliveriesFinished: number;
	};
	/** Every audio object kept, whatever its age. */
	audioStorageBytes: number;
	cost: AdminStatsCost;
};

/** One day of the pipeline, every figure zero when nothing ran. */
export type AdminStatsDay = AdminStatsUsage & {
	day: DayKey;
	articles: number;
	briefsProduced: number;
	briefsFailed: number;
	/** Runs that went through but kept no article: a quiet day, not a failure. */
	briefsWithoutArticles: number;
	fetchesFailed: number;
	deliveriesTotal: number;
	deliveriesFinished: number;
	deliveriesFailed: number;
	/** From the job's creation to its end, finished runs only. */
	averageBriefDurationSeconds: number | null;
};

export type AdminStatsProviderRow = {
	id: string;
	name: string;
	isEnabled: boolean;
	lastFetchedAt: Date | null;
	/** When an article of this source was last stored, whatever the window. */
	lastArticleAt: Date | null;
	articlesInWindow: number;
	fetchesFailedInWindow: number;
};

export type AdminStatsCategoryRow = {
	id: string;
	name: string;
	isEnabled: boolean;
	subscribersCount: number;
	briefsProducedInWindow: number;
	tokensInWindow: number;
};
