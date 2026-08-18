export type SubscriptionTarget = {
	userId: string;
	categoryId: string;
};

/**
 * One page of a topic list. The subscribed and available lists take the same
 * input: they differ by their filter and their order, not by their parameters.
 */
export type ListTopicsInput = {
	userId: string;
	page?: number;
	search?: string;
};

/** Same shape after normalisation, with every value settled. */
export type NormalizedListTopicsInput = {
	page: number;
	pageSize: number;
	/** Ready-to-use ILIKE pattern, or undefined when no search is active. */
	searchPattern: string | undefined;
};

export type TopicCard = {
	id: string;
	name: string;
	description: string;
	createdAt: Date;
	/** A disabled topic produces no new brief until an admin re-enables it. */
	isEnable: boolean;
	/** Briefs a reader can open: finished jobs that produced a script. */
	briefsCount: number;
	/** When this user subscribed. Null on the available list. */
	subscribedAt: Date | null;
};
