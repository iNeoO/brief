export const JOB_STATUS = {
	PENDING: "pending",
	RUNNING: "running",
	FINISHED: "finished",
	FAILED: "failed",
} as const;

export const JOB_STATE = {
	GETTING_ARTICLES: "getting_articles",
	CREATING_REPORT: "creating_report",
	CREATING_AUDIO: "creating_audio",
	SENDING_MESSAGE: "sending_message",
} as const;
