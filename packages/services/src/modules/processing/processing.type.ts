import type { CategoryJobState } from "@brief/common/types";
import type { ClaimedCategoryJob } from "../categoryJobs/categoryJobs.type.js";

/**
 * Carried through the pipeline: every step reads what the previous one
 * produced, and a resumed job starts from what the database already holds.
 */
export type CategoryJobContext = {
	job: ClaimedCategoryJob;
	summary: string | null;
};

/** One step of the pipeline, named by the state a job sits in while it runs. */
export type CategoryJobStep = {
	state: CategoryJobState;
	run: (context: CategoryJobContext) => Promise<void>;
};
