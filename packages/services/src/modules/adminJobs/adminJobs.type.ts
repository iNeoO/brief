import type {
	CategoryJobSort,
	CategoryJobState,
	CategoryJobStatus,
	FetchJobSort,
	JobStatus,
	SortOrder,
} from "@brief/common/types";
import type { PageWindow } from "../../helpers/listQuery.helper.js";

/**
 * One page of a job list, as it arrives from a URL: every value optional, and
 * none of them trusted. The two lists differ only by the sort keys and the
 * statuses they accept, hence the parameters.
 */
export type ListJobsInput<TSort extends string, TStatus extends string> = {
	page?: number;
	pageSize?: number;
	sort?: TSort;
	order?: SortOrder;
	search?: string;
	status?: TStatus;
};

/** Same shape after normalisation, with every value settled. */
export type NormalizedListJobsInput<
	TSort extends string,
	TStatus extends string,
> = PageWindow & {
	sort: TSort;
	order: SortOrder;
	/** Ready-to-use ILIKE pattern, or undefined when no search is active. */
	searchPattern: string | undefined;
	/** Undefined when no status is asked for, or one this list does not know. */
	status: TStatus | undefined;
};

export type ListAdminCategoryJobsInput = ListJobsInput<
	CategoryJobSort,
	CategoryJobStatus
>;

export type ListAdminFetchJobsInput = ListJobsInput<FetchJobSort, JobStatus>;

/**
 * How the deliveries of one brief went. `total` is zero for a job that never
 * reached the fan-out — which is what tells "delivered to nobody" apart from
 * "not delivered yet".
 */
export type AdminJobDeliveries = {
	total: number;
	finished: number;
	failed: number;
};

export type AdminCategoryJobRow = {
	id: number;
	category: { id: string; name: string };
	targetDate: Date;
	status: CategoryJobStatus;
	state: CategoryJobState;
	retry: number;
	articlesCount: number;
	totalTokens: number;
	deliveries: AdminJobDeliveries;
	/** Seconds from creation to the terminal status; null while it runs. */
	durationSeconds: number | null;
	error: string | null;
	createdAt: Date;
	finishedAt: Date | null;
};

export type AdminFetchJobRow = {
	id: number;
	provider: { id: string; name: string };
	targetDate: Date;
	status: JobStatus;
	retry: number;
	articlesCount: number;
	durationSeconds: number | null;
	error: string | null;
	createdAt: Date;
	finishedAt: Date | null;
};
