import type {
	CATEGORY_JOB_STATE,
	JOB_STATUS,
} from "../constants/jobs.constant.js";

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export type CategoryJobState =
	(typeof CATEGORY_JOB_STATE)[keyof typeof CATEGORY_JOB_STATE];
