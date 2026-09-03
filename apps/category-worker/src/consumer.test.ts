import {
	CATEGORY_JOB_OUTCOME,
	CATEGORY_RETRY_DELAYS_MS,
	INTERNAL_ERROR_CODE,
} from "@brief/common/constants";
import { InternalError } from "@brief/infra/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryConsumer } from "./consumer.js";

const JOB_ID = 42;

const claimJob = vi.fn();
const markFinished = vi.fn();
const markFailed = vi.fn();
const incrementRetry = vi.fn();
const runCategoryJob = vi.fn();
const fanOut = vi.fn();
const publishMessage = vi.fn();
const publishRetry = vi.fn();

const channel = {
	ack: vi.fn(),
	nack: vi.fn(),
};

const QUEUE = "category_jobs";

/** The body the publisher sends, and no `x-death` — a first delivery. */
const message = () =>
	({
		content: Buffer.from(JSON.stringify({ id: JOB_ID })),
		properties: { headers: {} },
		fields: {},
	}) as never;

/** A message that has already been through the holding queue `count` times. */
const deferredMessage = (count: number) =>
	({
		content: Buffer.from(JSON.stringify({ id: JOB_ID })),
		properties: {
			headers: { "x-death": [{ queue: `${QUEUE}.retry`, count }] },
		},
		fields: {},
	}) as never;

const consumer = (msg: unknown = message()) => {
	const instance = new CategoryConsumer(
		"category-test",
		"amqp://localhost",
		QUEUE,
		"category",
		{
			categoryJobsService: {
				claimJob,
				markFinished,
				markFailed,
				incrementRetry,
			},
			processingService: { runCategoryJob },
			messageJobsService: { fanOut },
			messagePublisher: { publish: publishMessage },
			retryPublisher: { publish: publishRetry },
			// The consumer only ever reaches these four methods and two
			// publishers; the real services carry a database and a connection.
		} as never,
	);

	const logger = (
		instance as unknown as {
			logger: Record<string, () => void>;
		}
	).logger;

	return {
		handle: () =>
			(
				instance as unknown as {
					handleMessage: (c: unknown, m: unknown) => Promise<void>;
				}
			).handleMessage(channel, msg),
		logger: vi.spyOn(logger, "error"),
		warnings: vi.spyOn(logger, "warn"),
	};
};

beforeEach(() => {
	vi.clearAllMocks();
	claimJob.mockResolvedValue({ id: JOB_ID, state: "creating_report" });
	runCategoryJob.mockResolvedValue({
		outcome: CATEGORY_JOB_OUTCOME.PRODUCED,
		context: { summary: "Le brief." },
	});
	markFinished.mockResolvedValue([{ id: JOB_ID }]);
	fanOut.mockResolvedValue([1, 2]);
	publishMessage.mockResolvedValue(undefined);
	publishRetry.mockResolvedValue(undefined);
});

describe("handleMessage", () => {
	it("finishes and fans out a job that produced a brief", async () => {
		await consumer().handle();

		expect(markFinished).toHaveBeenCalledWith(JOB_ID);
		expect(fanOut).toHaveBeenCalledWith(JOB_ID);
		expect(publishMessage).toHaveBeenCalledTimes(2);
		expect(channel.ack).toHaveBeenCalledOnce();
	});

	// The whole point of the status: a quiet day acks and stops. Retrying it
	// would replay a paid-for LLM call to reach the same verdict, and failing it
	// would put an ordinary outcome in the `failed` gauge.
	describe("when the selection kept no article", () => {
		beforeEach(() => {
			runCategoryJob.mockResolvedValue({
				outcome: CATEGORY_JOB_OUTCOME.NO_ARTICLES_SELECTED,
				context: { summary: null },
			});
		});

		it("acks without finishing, retrying or dead-lettering the job", async () => {
			await consumer().handle();

			expect(channel.ack).toHaveBeenCalledOnce();
			expect(channel.nack).not.toHaveBeenCalled();
			expect(markFinished).not.toHaveBeenCalled();
			expect(markFailed).not.toHaveBeenCalled();
			expect(incrementRetry).not.toHaveBeenCalled();
			expect(publishRetry).not.toHaveBeenCalled();
		});

		it("delivers the brief to nobody", async () => {
			await consumer().handle();

			expect(fanOut).not.toHaveBeenCalled();
			expect(publishMessage).not.toHaveBeenCalled();
		});

		it("does not log it as an error", async () => {
			const { handle, logger } = consumer();

			await handle();

			expect(logger).not.toHaveBeenCalled();
		});
	});

	it("still retries a job that broke for a real reason", async () => {
		runCategoryJob.mockRejectedValue(new Error("the model timed out"));
		incrementRetry.mockResolvedValue({ status: "pending", retry: 1 });

		await consumer().handle();

		expect(incrementRetry).toHaveBeenCalledWith(JOB_ID, "the model timed out");
		expect(publishRetry).toHaveBeenCalledOnce();
		expect(fanOut).not.toHaveBeenCalled();
	});
});

describe("a message that cannot be read", () => {
	it("dead-letters it instead of guessing a job id", async () => {
		const unparseable = {
			content: Buffer.from("not json"),
			properties: { headers: {} },
			fields: {},
		} as never;
		const { handle, logger } = consumer(unparseable);

		await handle();

		expect(logger).toHaveBeenCalledOnce();
		expect(channel.nack).toHaveBeenCalledWith(unparseable, false, false);
		expect(claimJob).not.toHaveBeenCalled();
	});
});

describe("a job that is no longer claimable", () => {
	beforeEach(() => {
		claimJob.mockResolvedValue(undefined);
	});

	it("fans the brief out anyway, in case that is what was missed", async () => {
		// This is where a crash between `markFinished` and the fan-out is
		// repaired: without it the brief would be published and delivered to
		// nobody. `fanOut` ignores a job that is not finished, so an ordinary
		// duplicate stays a no-op.
		const { handle, warnings } = consumer();

		await handle();

		expect(warnings).toHaveBeenCalledOnce();
		expect(fanOut).toHaveBeenCalledWith(JOB_ID);
		expect(channel.ack).toHaveBeenCalledOnce();
		expect(runCategoryJob).not.toHaveBeenCalled();
	});
});

describe("a claim that threw", () => {
	it("goes through the failure bookkeeping", async () => {
		claimJob.mockRejectedValue(new Error("connection reset"));
		incrementRetry.mockResolvedValue({ status: "pending", retry: 2 });

		await consumer().handle();

		expect(incrementRetry).toHaveBeenCalledWith(JOB_ID, "connection reset");
		expect(publishRetry).toHaveBeenCalledWith(
			{ id: JOB_ID },
			{ delayMs: CATEGORY_RETRY_DELAYS_MS[1] },
		);
	});
});

describe("a job that could not be marked finished", () => {
	it("treats the lost race as a failure", async () => {
		markFinished.mockResolvedValue([]);
		incrementRetry.mockResolvedValue({ status: "pending", retry: 1 });

		await consumer().handle();

		expect(incrementRetry).toHaveBeenCalledWith(
			JOB_ID,
			`Category job ${JOB_ID} could not be marked finished`,
		);
		// Nothing is delivered for a brief the row does not call finished.
		expect(fanOut).not.toHaveBeenCalled();
	});
});

describe("a failure no retry would survive", () => {
	it("fails the job outright and dead-letters the message", async () => {
		// A missing audio file will not appear on the second attempt: burning
		// three tries only delays the error.
		runCategoryJob.mockRejectedValue(
			new InternalError({
				code: INTERNAL_ERROR_CODE.CATEGORY_JOB_MISSING_AUDIO,
				message: "no audio",
			}),
		);
		markFailed.mockResolvedValue({ status: "failed", retry: 0 });

		await consumer().handle();

		expect(markFailed).toHaveBeenCalledWith(JOB_ID, "no audio");
		expect(incrementRetry).not.toHaveBeenCalled();
		expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
		expect(publishRetry).not.toHaveBeenCalled();
	});

	it("dead-letters a job that has run out of tries", async () => {
		runCategoryJob.mockRejectedValue(new Error("the model timed out"));
		incrementRetry.mockResolvedValue({ status: "failed", retry: 3 });

		await consumer().handle();

		expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
	});

	it("dead-letters what it threw over when the bookkeeping itself fails", async () => {
		// The row cannot be updated, so nothing would ever settle this job:
		// keeping the message would only spin.
		runCategoryJob.mockRejectedValue(new Error("the model timed out"));
		incrementRetry.mockRejectedValue(new Error("the database is down"));

		const { handle, logger } = consumer();
		await handle();

		expect(logger).toHaveBeenCalledTimes(2);
		expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
	});

	it("stringifies a rejection that is not an error", async () => {
		runCategoryJob.mockRejectedValue("nope");
		incrementRetry.mockResolvedValue({ status: "failed", retry: 3 });

		await consumer().handle();

		expect(incrementRetry).toHaveBeenCalledWith(JOB_ID, "nope");
	});
});

describe("a fan-out that could not be published", () => {
	beforeEach(() => {
		fanOut.mockRejectedValue(new Error("the broker is down"));
	});

	it("defers the message without touching the finished job", async () => {
		// `failJob` here would put the job back to `pending` and replay the whole
		// pipeline — LLM and text-to-speech included — over a queue that was
		// briefly down.
		const { handle, logger } = consumer();

		await handle();

		expect(logger).toHaveBeenCalledOnce();
		expect(publishRetry).toHaveBeenCalledWith(
			{ id: JOB_ID },
			{ delayMs: CATEGORY_RETRY_DELAYS_MS[0] },
		);
		expect(incrementRetry).not.toHaveBeenCalled();
		expect(markFailed).not.toHaveBeenCalled();
	});

	it("gives up once the message has circled the holding queue too often", async () => {
		// The job's own retry counter stopped applying when it finished, so this
		// tally is the only thing bounding the cycle.
		const { handle } = consumer(deferredMessage(10));

		await handle();

		expect(publishRetry).not.toHaveBeenCalled();
		expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
	});

	it("keeps deferring while it still has trips left", async () => {
		const { handle } = consumer(deferredMessage(9));

		await handle();

		expect(publishRetry).toHaveBeenCalledOnce();
	});

	it("redelivers at once when the holding queue itself refuses the message", async () => {
		// Nothing else would ever drive this job again, so an immediate
		// redelivery is the lesser evil.
		publishRetry.mockRejectedValue(new Error("the broker is really down"));
		const { handle } = consumer();

		await handle();

		expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
	});
});
