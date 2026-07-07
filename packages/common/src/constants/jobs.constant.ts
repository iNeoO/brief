export const JOB_STATUS = {
	PENDING: "pending",
	RUNNING: "running",
	FINISHED: "finished",
	FAILED: "failed",
} as const;

export const MAX_JOB_RETRY = 3;

export const CATEGORY_JOB_STATE = {
	CREATING_REPORT: "creating_report",
	CREATING_AUDIO: "creating_audio",
	SENDING_MESSAGE: "sending_message",
} as const;
