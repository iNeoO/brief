import type {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
	JOB_STATUS,
} from "../constants/jobs.constant.js";

export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export type CategoryJobStatus =
	(typeof CATEGORY_JOB_STATUS)[keyof typeof CATEGORY_JOB_STATUS];

export type CategoryJobState =
	(typeof CATEGORY_JOB_STATE)[keyof typeof CATEGORY_JOB_STATE];
