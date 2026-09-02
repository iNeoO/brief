import type { CategoryJobOutcome, CategoryJobState } from "@brief/common/types";
import type { ClaimedCategoryJob } from "../categoryJobs/categoryJobs.type.js";

export type CategoryJobContext = {
	job: ClaimedCategoryJob;
	summary: string | null;
};

export type CategoryJobRun = {
	outcome: CategoryJobOutcome;
	context: CategoryJobContext;
};

export type CategoryJobStep = {
	state: CategoryJobState;
	run: (context: CategoryJobContext) => Promise<CategoryJobOutcome>;
};
