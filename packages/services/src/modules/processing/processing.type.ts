import type { CategoryJobState } from "@brief/common/types";
import type { ClaimedCategoryJob } from "../categoryJobs/categoryJobs.type.js";

export type CategoryJobContext = {
	job: ClaimedCategoryJob;
	summary: string | null;
};

export type CategoryJobStep = {
	state: CategoryJobState;
	run: (context: CategoryJobContext) => Promise<void>;
};
