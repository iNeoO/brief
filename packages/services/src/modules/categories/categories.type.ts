import type {
	CategoryJobStatus,
	CategorySort,
	Language,
	SortOrder,
} from "@brief/common/types";
import type { PageWindow } from "../../helpers/listQuery.helper.js";

export type ListAdminCategoriesInput = {
	page?: number;
	pageSize?: number;
	sort?: CategorySort;
	order?: SortOrder;
	search?: string;
};

/** Same shape after normalisation, with every value settled. */
export type NormalizedListAdminCategoriesInput = PageWindow & {
	sort: CategorySort;
	order: SortOrder;
	/** Ready-to-use ILIKE pattern, or undefined when no search is active. */
	searchPattern: string | undefined;
};

export type AdminCategoryLastBrief = {
	targetDate: Date;
	status: CategoryJobStatus;
};

export type AdminCategoryRow = {
	id: string;
	name: string;
	description: string;
	isEnabled: boolean;
	createdAt: Date;
	briefsCount: number;
	subscribersCount: number;
	/** Null until the category has been through the pipeline at least once. */
	lastBrief: AdminCategoryLastBrief | null;
};

/** What the create and edit modal needs, which the list does not carry. */
export type AdminCategoryDetail = {
	id: string;
	name: string;
	description: string;
	language: Language;
	isEnabled: boolean;
	providerIds: string[];
};

export type CategoryWriteInput = {
	name: string;
	description: string;
	language: Language;
	isEnabled: boolean;
	providerIds: string[];
};

export type UpdateCategoryInput = CategoryWriteInput & { id: string };

/** An object to remove from the bucket once the database transaction commits. */
export type DeletedFileTarget = {
	bucket: string;
	objectKey: string;
};
