import {
	CATEGORY_JOB_STATUS,
	FILE_KIND,
	JOB_STATUS,
	MAX_JOB_RETRY,
	TELEGRAM_PAIRING_STATUS,
} from "@brief/common/constants";
import type { Locale } from "@brief/common/types";
import { formatDateToYMD } from "@brief/common/utils";
import { and, type Database, eq, schema } from "@brief/drizzle";
import { getLoggerStore } from "@brief/infra/libs";
import type { ClaimedMessageJob } from "./messageJobs.type.js";

export class MessageJobsService {
	constructor(private db: Database) {}

	/**
	 * Creates the delivery rows for a finished category job and returns the ids
	 * still waiting to be sent.
	 *
	 * The two halves are separate on purpose. Returning only the rows just
	 * inserted would repair nothing when the insert succeeded and the publication
	 * did not: those rows would sit `pending` for ever, with a brief produced,
	 * published on the site, and delivered to nobody. Returning everything still
	 * `pending` heals both halves of that failure, and the claim makes a duplicate
	 * publication a no-op.
	 */
	async fanOut(categoryJobId: number) {
		const logger = getLoggerStore();

		const job = await this.db.query.categoryJobs.findFirst({
			columns: { categoryId: true, status: true, targetDate: true },
			where: { id: categoryJobId },
		});

		if (!job) return [];

		// The audio travels as a link to the public brief endpoint, which only
		// serves a finished job. Fanning out earlier would hand Telegram a 404.
		//
		// Debug rather than a warning: the redelivery path calls this for every
		// category message RabbitMQ repeats, and most of those are still running.
		if (job.status !== CATEGORY_JOB_STATUS.FINISHED) {
			logger.debug(
				{ categoryJobId, status: job.status },
				"category job is not finished, not fanning out",
			);
			return [];
		}

		// A brief is the morning's news. Replaying an old job — by hand, or after a
		// retry that crossed midnight — must not mail yesterday's paper today.
		const today = formatDateToYMD(new Date());
		if (formatDateToYMD(job.targetDate) !== today) {
			logger.warn(
				{ categoryJobId, targetDate: job.targetDate, today },
				"category job is not today's, not fanning out",
			);
			return [];
		}

		const recipients = await this.db
			.select({ userId: schema.subscriptions.userId })
			.from(schema.subscriptions)
			.innerJoin(
				schema.telegramPairings,
				eq(schema.telegramPairings.userId, schema.subscriptions.userId),
			)
			.innerJoin(schema.user, eq(schema.user.id, schema.subscriptions.userId))
			.where(
				and(
					eq(schema.subscriptions.categoryId, job.categoryId),
					// Only a reader who authorised us, and has not withdrawn it.
					eq(schema.telegramPairings.status, TELEGRAM_PAIRING_STATUS.VERIFIED),
					eq(schema.user.banned, false),
				),
			);

		if (recipients.length > 0) {
			await this.db
				.insert(schema.messageJobs)
				.values(
					recipients.map(({ userId }) => ({
						categoryJobId,
						userId,
						status: JOB_STATUS.PENDING,
					})),
				)
				.onConflictDoNothing();
		}

		const pending = await this.db
			.select({ id: schema.messageJobs.id })
			.from(schema.messageJobs)
			.where(
				and(
					eq(schema.messageJobs.categoryJobId, categoryJobId),
					eq(schema.messageJobs.status, JOB_STATUS.PENDING),
				),
			);

		return pending.map(({ id }) => id);
	}

	/**
	 * Takes the job out of `pending` and reads everything the send needs in the
	 * same breath. Returns nothing when the row is already claimed or done, which
	 * is what makes a RabbitMQ redelivery harmless.
	 */
	async claim(id: number): Promise<ClaimedMessageJob | undefined> {
		return await this.db.transaction(async (tx) => {
			const [claimed] = await tx
				.update(schema.messageJobs)
				.set({ status: JOB_STATUS.RUNNING })
				.where(
					and(
						eq(schema.messageJobs.id, id),
						eq(schema.messageJobs.status, JOB_STATUS.PENDING),
					),
				)
				.returning();

			if (!claimed) return undefined;

			const [context] = await tx
				.select({
					chatId: schema.telegramPairings.chatId,
					locale: schema.telegramPairings.locale,
					pairingStatus: schema.telegramPairings.status,
					categoryName: schema.categories.name,
					targetDate: schema.categoryJobs.targetDate,
					audioFileId: schema.files.id,
				})
				.from(schema.categoryJobs)
				.innerJoin(
					schema.categories,
					eq(schema.categories.id, schema.categoryJobs.categoryId),
				)
				// Left: withdrawing the authorisation deletes the pairing row outright,
				// and an inner join would then return nothing at all — leaving this job
				// claimed, `running`, and never resolved either way.
				.leftJoin(
					schema.telegramPairings,
					eq(schema.telegramPairings.userId, claimed.userId),
				)
				// Left, so a job whose audio never landed still comes back and can be
				// failed with a clear reason instead of vanishing.
				.leftJoin(
					schema.files,
					and(
						eq(schema.files.categoryJobId, schema.categoryJobs.id),
						eq(schema.files.kind, FILE_KIND.AUDIO_FILE),
						eq(schema.files.language, schema.categories.language),
					),
				)
				.where(eq(schema.categoryJobs.id, claimed.categoryJobId))
				.limit(1);

			// The foreign keys make this unreachable; returning undefined here rather
			// than throwing would leave the row stuck in `running`.
			if (!context) {
				throw new Error(
					`Message job ${id} points at category job ${claimed.categoryJobId}, which no longer exists`,
				);
			}

			return {
				id: claimed.id,
				categoryJobId: claimed.categoryJobId,
				userId: claimed.userId,
				retry: claimed.retry,
				isFirst: claimed.isFirst,
				pairing:
					context.chatId && context.pairingStatus
						? {
								chatId: context.chatId,
								locale: context.locale as Locale,
								status: context.pairingStatus,
							}
						: null,
				categoryName: context.categoryName,
				targetDate: context.targetDate,
				audioFileId: context.audioFileId,
			};
		});
	}

	/**
	 * Decides, once and for all, whether this delivery opens the reader's day.
	 *
	 * The insert is the decision: Postgres hands the row to exactly one caller, so
	 * two category jobs finishing in the same millisecond cannot both claim it. The
	 * answer is then written onto the job, because asking again on a retry would
	 * find the row already there — put there by this very job — and wrongly
	 * conclude that somebody else had opened the day.
	 */
	async claimAnnouncement({
		id,
		userId,
		targetDate,
		known,
	}: {
		id: number;
		userId: string;
		targetDate: Date;
		known: boolean | null;
	}) {
		if (known !== null) return known;

		const won = await this.db
			.insert(schema.messageAnnouncements)
			.values({ userId, targetDate })
			.onConflictDoNothing()
			.returning({ userId: schema.messageAnnouncements.userId });

		const isFirst = won.length > 0;

		await this.db
			.update(schema.messageJobs)
			.set({ isFirst })
			.where(eq(schema.messageJobs.id, id));

		return isFirst;
	}

	async markFinished(id: number) {
		return await this.db
			.update(schema.messageJobs)
			.set({
				status: JOB_STATUS.FINISHED,
				error: null,
				finishedAt: new Date(),
			})
			.where(eq(schema.messageJobs.id, id))
			.returning();
	}

	async markFailed(id: number, error: string) {
		return await this.db
			.update(schema.messageJobs)
			.set({ status: JOB_STATUS.FAILED, error, finishedAt: new Date() })
			.where(eq(schema.messageJobs.id, id))
			.returning();
	}

	/**
	 * Puts the job back in the queue's reach, or ends it once the attempts run out.
	 * The counter lives on the row rather than in the message: a delayed retry is
	 * republished, and a republished message carries no history.
	 */
	async incrementRetry(id: number, error: string) {
		const [current] = await this.db
			.select({ retry: schema.messageJobs.retry })
			.from(schema.messageJobs)
			.where(eq(schema.messageJobs.id, id));

		if (!current) return undefined;

		const retry = current.retry + 1;
		const exhausted = retry >= MAX_JOB_RETRY;

		const [job] = await this.db
			.update(schema.messageJobs)
			.set({
				retry,
				error,
				status: exhausted ? JOB_STATUS.FAILED : JOB_STATUS.PENDING,
				finishedAt: exhausted ? new Date() : null,
			})
			.where(eq(schema.messageJobs.id, id))
			.returning();

		return job;
	}
}
