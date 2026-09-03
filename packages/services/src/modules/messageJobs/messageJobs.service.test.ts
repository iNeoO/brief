import {
	CATEGORY_JOB_STATUS,
	FILE_KIND,
	JOB_STATUS,
	MAX_JOB_RETRY,
	TELEGRAM_PAIRING_STATUS,
} from "@brief/common/constants";
import { and, eq, schema } from "@brief/drizzle";
import { type PinoLogger, wrapWithLogger } from "@brief/infra/libs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	asDatabase,
	fakeTransaction,
	recordingChain,
} from "../../testing/db.fake.js";
import { MessageJobsService } from "./messageJobs.service.js";

const MESSAGE_JOB_ID = 7;
const CATEGORY_JOB_ID = 42;
const CATEGORY_ID = "category-1";
const USER_ID = "user-1";

/** 08:30 in Paris, so the calendar day the service compares against is the 17th. */
const NOW = new Date("2026-08-17T06:30:00.000Z");
const TARGET_DATE = new Date("2026-08-17T00:00:00.000Z");

const logger = { debug: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() };

type Rows = {
	/** The category job `fanOut` reads through the relational API. */
	categoryJob?: Record<string, unknown>;
	/** The subscribers eligible for a delivery. */
	recipients?: { userId: string }[];
	/** What a read of `message_jobs` answers: the pending ids, or the current row. */
	messageJobs?: Record<string, unknown>[];
	/** The context `claim` joins together. */
	context?: Record<string, unknown>[];
	/** What `update(...).returning()` hands back; empty stands for a guard that refused. */
	updated?: Record<string, unknown>[];
	/** The announcement row the insert won, if it won it. */
	announcement?: Record<string, unknown>[];
};

/**
 * Reads are dispatched on the table they select from, writes on the table they
 * touch, so every query keeps its own rows and its own recorded clauses.
 */
const harness = (rows: Rows = {}) => {
	const findFirst = vi.fn().mockResolvedValue(rows.categoryJob);
	const update = recordingChain(rows.updated ?? [{ id: MESSAGE_JOB_ID }]);
	const inserts = {
		messageJobs: recordingChain(),
		announcements: recordingChain(rows.announcement ?? []),
	};
	const reads = {
		subscriptions: recordingChain(rows.recipients ?? []),
		messageJobs: recordingChain(rows.messageJobs ?? []),
		categoryJobs: recordingChain(rows.context ?? []),
	};

	const from = (table: unknown) => {
		if (table === schema.subscriptions) return reads.subscriptions;
		if (table === schema.categoryJobs) return reads.categoryJobs;
		return reads.messageJobs;
	};

	const insert = (table: unknown) =>
		table === schema.messageAnnouncements
			? inserts.announcements.insert(table)
			: inserts.messageJobs.insert(table);

	const db = {
		query: { categoryJobs: { findFirst } },
		select: () => ({ from }),
		update: (table: unknown) => update.update(table),
		insert,
	};

	return {
		findFirst,
		update,
		inserts,
		reads,
		service: new MessageJobsService(
			asDatabase({ ...db, ...fakeTransaction(db) }),
		),
	};
};

/** `fanOut` reports its refusals through the async-local logger. */
const run = <T>(cb: () => Promise<T>) =>
	wrapWithLogger(logger as unknown as PinoLogger, cb);

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
});

describe("fanOut", () => {
	const finished = {
		categoryJob: {
			categoryId: CATEGORY_ID,
			status: CATEGORY_JOB_STATUS.FINISHED,
			targetDate: TARGET_DATE,
		},
	};

	it("creates one delivery per verified subscriber and returns the pending ids", async () => {
		const { service, inserts, reads } = harness({
			...finished,
			recipients: [{ userId: USER_ID }, { userId: "user-2" }],
			messageJobs: [{ id: MESSAGE_JOB_ID }, { id: 8 }],
		});

		await expect(run(() => service.fanOut(CATEGORY_JOB_ID))).resolves.toEqual([
			MESSAGE_JOB_ID,
			8,
		]);

		expect(inserts.messageJobs.args("values")).toEqual([
			[
				{
					categoryJobId: CATEGORY_JOB_ID,
					userId: USER_ID,
					status: JOB_STATUS.PENDING,
				},
				{
					categoryJobId: CATEGORY_JOB_ID,
					userId: "user-2",
					status: JOB_STATUS.PENDING,
				},
			],
		]);
		// A repeated publication must not create a second delivery per reader.
		expect(inserts.messageJobs.args("onConflictDoNothing")).toEqual([]);
		expect(reads.messageJobs.args("where")).toEqual([
			and(
				eq(schema.messageJobs.categoryJobId, CATEGORY_JOB_ID),
				eq(schema.messageJobs.status, JOB_STATUS.PENDING),
			),
		]);
	});

	it("only writes to readers who authorised us and are not banned", async () => {
		const { service, reads } = harness({
			...finished,
			recipients: [{ userId: USER_ID }],
		});

		await run(() => service.fanOut(CATEGORY_JOB_ID));

		expect(reads.subscriptions.args("where")).toEqual([
			and(
				eq(schema.subscriptions.categoryId, CATEGORY_ID),
				eq(schema.telegramPairings.status, TELEGRAM_PAIRING_STATUS.VERIFIED),
				eq(schema.user.banned, false),
			),
		]);
	});

	it("still reports the deliveries left pending when nobody new was added", async () => {
		// The self-healing half: an earlier run inserted the rows and then failed
		// to publish them, so the ids must come back even with no recipient now.
		const { service, inserts } = harness({
			...finished,
			recipients: [],
			messageJobs: [{ id: MESSAGE_JOB_ID }],
		});

		await expect(run(() => service.fanOut(CATEGORY_JOB_ID))).resolves.toEqual([
			MESSAGE_JOB_ID,
		]);

		expect(inserts.messageJobs.calls).toEqual([]);
	});

	it("delivers nothing for a category job that does not exist", async () => {
		const { service } = harness({ categoryJob: undefined });

		await expect(run(() => service.fanOut(CATEGORY_JOB_ID))).resolves.toEqual(
			[],
		);
	});

	it("waits for the brief to be finished before fanning out", async () => {
		// The audio travels as a link to an endpoint that only serves a finished
		// job, so an early fan-out would hand Telegram a 404.
		const { service, reads } = harness({
			categoryJob: { ...finished.categoryJob, status: JOB_STATUS.RUNNING },
		});

		await expect(run(() => service.fanOut(CATEGORY_JOB_ID))).resolves.toEqual(
			[],
		);
		expect(reads.subscriptions.calls).toEqual([]);
		// Debug, not a warning: every redelivery of a running job lands here.
		expect(logger.debug).toHaveBeenCalledOnce();
		expect(logger.warn).not.toHaveBeenCalled();
	});

	it("refuses to send yesterday's paper today", async () => {
		const { service, reads } = harness({
			categoryJob: {
				...finished.categoryJob,
				targetDate: new Date("2026-08-15T00:00:00.000Z"),
			},
		});

		await expect(run(() => service.fanOut(CATEGORY_JOB_ID))).resolves.toEqual(
			[],
		);
		expect(reads.subscriptions.calls).toEqual([]);
		// A replayed old job is worth a warning: somebody asked for it.
		expect(logger.warn).toHaveBeenCalledOnce();
	});

	it("reads the target date in Paris, not in UTC", async () => {
		// 23:00 UTC on the 16th is already the 17th in Paris, which is the day the
		// brief belongs to — fanning out has to accept it.
		const { service } = harness({
			categoryJob: {
				...finished.categoryJob,
				targetDate: new Date("2026-08-16T23:00:00.000Z"),
			},
			recipients: [{ userId: USER_ID }],
			messageJobs: [{ id: MESSAGE_JOB_ID }],
		});

		await expect(run(() => service.fanOut(CATEGORY_JOB_ID))).resolves.toEqual([
			MESSAGE_JOB_ID,
		]);
	});
});

describe("claim", () => {
	const claimed = [
		{
			id: MESSAGE_JOB_ID,
			categoryJobId: CATEGORY_JOB_ID,
			userId: USER_ID,
			retry: 0,
			isFirst: null,
		},
	];

	const context = [
		{
			chatId: "chat-1",
			locale: "fr",
			pairingStatus: TELEGRAM_PAIRING_STATUS.VERIFIED,
			categoryName: "Actu France",
			targetDate: TARGET_DATE,
			audioFileId: "file-1",
		},
	];

	it("takes the job and reads everything the send needs", async () => {
		const { service, update, reads } = harness({ updated: claimed, context });

		await expect(service.claim(MESSAGE_JOB_ID)).resolves.toEqual({
			id: MESSAGE_JOB_ID,
			categoryJobId: CATEGORY_JOB_ID,
			userId: USER_ID,
			retry: 0,
			isFirst: null,
			pairing: {
				chatId: "chat-1",
				locale: "fr",
				status: TELEGRAM_PAIRING_STATUS.VERIFIED,
			},
			categoryName: "Actu France",
			targetDate: TARGET_DATE,
			audioFileId: "file-1",
		});

		expect(update.args("set")).toEqual([{ status: JOB_STATUS.RUNNING }]);
		expect(update.args("where")).toEqual([
			and(
				eq(schema.messageJobs.id, MESSAGE_JOB_ID),
				eq(schema.messageJobs.status, JOB_STATUS.PENDING),
			),
		]);
		expect(reads.categoryJobs.args("limit")).toEqual([1]);
	});

	it("returns nothing when the job is no longer pending", async () => {
		// This is what makes a RabbitMQ redelivery harmless.
		const { service, reads } = harness({ updated: [] });

		await expect(service.claim(MESSAGE_JOB_ID)).resolves.toBeUndefined();
		expect(reads.categoryJobs.calls).toEqual([]);
	});

	it("reports no pairing when the reader withdrew their authorisation", async () => {
		// The pairing row is deleted outright, so the left join answers with nulls
		// and the job must still come back — to be failed with a clear reason.
		const { service } = harness({
			updated: claimed,
			context: [{ ...context[0], chatId: null, pairingStatus: null }],
		});

		await expect(service.claim(MESSAGE_JOB_ID)).resolves.toMatchObject({
			pairing: null,
		});
	});

	it("hands back a job whose audio never landed", async () => {
		const { service } = harness({
			updated: claimed,
			context: [{ ...context[0], audioFileId: null }],
		});

		await expect(service.claim(MESSAGE_JOB_ID)).resolves.toMatchObject({
			audioFileId: null,
		});
	});

	it("looks the audio up by job, kind and language", async () => {
		const { service, reads } = harness({ updated: claimed, context });

		await service.claim(MESSAGE_JOB_ID);

		expect(reads.categoryJobs.args("leftJoin")).toEqual([
			schema.files,
			and(
				eq(schema.files.categoryJobId, schema.categoryJobs.id),
				eq(schema.files.kind, FILE_KIND.AUDIO_FILE),
				eq(schema.files.language, schema.categories.language),
			),
		]);
	});

	it("throws rather than leave a claimed job unresolved", async () => {
		// Returning undefined here would strand the row in `running` for ever.
		const { service } = harness({ updated: claimed, context: [] });

		await expect(service.claim(MESSAGE_JOB_ID)).rejects.toThrow(
			`Message job ${MESSAGE_JOB_ID} points at category job ${CATEGORY_JOB_ID}, which no longer exists`,
		);
	});
});

describe("claimAnnouncement", () => {
	const target = {
		id: MESSAGE_JOB_ID,
		userId: USER_ID,
		targetDate: TARGET_DATE,
	};

	it("opens the reader's day when the insert wins the row", async () => {
		const { service, inserts, update } = harness({
			announcement: [{ userId: USER_ID }],
		});

		await expect(
			service.claimAnnouncement({ ...target, known: null }),
		).resolves.toBe(true);

		expect(inserts.announcements.args("values")).toEqual([
			{ userId: USER_ID, targetDate: TARGET_DATE },
		]);
		// The answer is written onto the job so a retry does not ask again.
		expect(update.args("set")).toEqual([{ isFirst: true }]);
		expect(update.args("where")).toEqual([
			eq(schema.messageJobs.id, MESSAGE_JOB_ID),
		]);
	});

	it("defers to another delivery that already opened the day", async () => {
		const { service, update } = harness({ announcement: [] });

		await expect(
			service.claimAnnouncement({ ...target, known: null }),
		).resolves.toBe(false);

		expect(update.args("set")).toEqual([{ isFirst: false }]);
	});

	it("trusts the answer already recorded on the job", async () => {
		// Asking again would find the row this very job inserted and wrongly
		// conclude somebody else had opened the day.
		const { service, inserts } = harness();

		await expect(
			service.claimAnnouncement({ ...target, known: true }),
		).resolves.toBe(true);
		await expect(
			service.claimAnnouncement({ ...target, known: false }),
		).resolves.toBe(false);

		expect(inserts.announcements.calls).toEqual([]);
	});
});

describe("markFinished", () => {
	it("settles the delivery and clears the error", async () => {
		const { service, update } = harness();

		await expect(service.markFinished(MESSAGE_JOB_ID)).resolves.toEqual([
			{ id: MESSAGE_JOB_ID },
		]);

		expect(update.args("set")).toEqual([
			{ status: JOB_STATUS.FINISHED, error: null, finishedAt: NOW },
		]);
	});
});

describe("markFailed", () => {
	it("records why the delivery ended", async () => {
		const { service, update } = harness();

		await service.markFailed(MESSAGE_JOB_ID, "chat not found");

		expect(update.args("set")).toEqual([
			{
				status: JOB_STATUS.FAILED,
				error: "chat not found",
				finishedAt: NOW,
			},
		]);
	});
});

describe("incrementRetry", () => {
	it("puts the job back in the queue's reach while attempts are left", async () => {
		const { service, update } = harness({ messageJobs: [{ retry: 0 }] });

		await expect(
			service.incrementRetry(MESSAGE_JOB_ID, "429"),
		).resolves.toEqual({ id: MESSAGE_JOB_ID });

		expect(update.args("set")).toEqual([
			{
				retry: 1,
				error: "429",
				status: JOB_STATUS.PENDING,
				finishedAt: null,
			},
		]);
	});

	it("ends the delivery once the attempts run out", async () => {
		const { service, update } = harness({
			messageJobs: [{ retry: MAX_JOB_RETRY - 1 }],
		});

		await service.incrementRetry(MESSAGE_JOB_ID, "429");

		expect(update.args("set")).toEqual([
			{
				retry: MAX_JOB_RETRY,
				error: "429",
				status: JOB_STATUS.FAILED,
				finishedAt: NOW,
			},
		]);
	});

	it("writes nothing when the job no longer exists", async () => {
		const { service, update } = harness({ messageJobs: [] });

		await expect(
			service.incrementRetry(MESSAGE_JOB_ID, "429"),
		).resolves.toBeUndefined();
		expect(update.calls).toEqual([]);
	});
});
