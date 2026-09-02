export const JOB_STATUS = {
	PENDING: "pending",
	RUNNING: "running",
	FINISHED: "finished",
	FAILED: "failed",
} as const;

export const CATEGORY_JOB_STATUS = {
	WAITING_FOR_PROVIDERS: "waiting_for_providers",
	...JOB_STATUS,
	/**
	 * The pipeline ran to the letter and the editorial selection kept nothing —
	 * a quiet news day for this category, not an incident. Terminal like
	 * `finished` and `failed`: no retry, no `error`, no audio, no delivery. It is
	 * a status of its own so that an alert on `failed` stays an alert on real
	 * breakage.
	 */
	NO_ARTICLES_SELECTED: "no_articles_selected",
} as const;

/**
 * How a run of the category pipeline ended.
 *
 * `produced` is the ordinary answer and the only one that owes anything
 * downstream: the brief exists, and the caller still has to finish the job and
 * fan it out. Every other value is a step that settled the job in the database
 * itself and stopped the run — the caller reads which ending it was and leaves
 * the row alone.
 */
export const CATEGORY_JOB_OUTCOME = {
	PRODUCED: "produced",
	NO_ARTICLES_SELECTED: CATEGORY_JOB_STATUS.NO_ARTICLES_SELECTED,
} as const;

export const MAX_JOB_RETRY = 3;

/**
 * How long a failed message job waits before Telegram is tried again, indexed by
 * the retry count it is about to make. Only consulted when Telegram gave us no
 * `retry_after` of its own: a 429 always carries one, and it wins.
 *
 * The delay is carried per message (`expiration` on the retry queue) rather than
 * by the queue, which is what lets a 429's own figure be honoured.
 */
export const MESSAGE_RETRY_DELAYS_MS = [30_000, 120_000, 600_000] as const;

/**
 * How long a failed category job waits before the pipeline is tried again,
 * indexed by the retry count it is about to make. Same mechanism as the message
 * delays, longer figures: a retry here replays the LLM and the text-to-speech,
 * so nothing is gained by racing a rate limiter that has just said no.
 */
export const CATEGORY_RETRY_DELAYS_MS = [60_000, 300_000, 900_000] as const;

/**
 * How long a failed provider fetch waits before the feed is read again. Shorter
 * than the others on purpose: every category job that depends on this fetch sits
 * in `waiting_for_providers` until it finishes, so a long wait here holds back
 * the morning's briefs.
 */
export const PROVIDER_FETCH_RETRY_DELAYS_MS = [
	15_000, 60_000, 300_000,
] as const;

export const CATEGORY_JOB_STATE = {
	CREATING_REPORT: "creating_report",
	CREATING_AUDIO: "creating_audio",
	SENDING_MESSAGE: "sending_message",
} as const;
