import { CATEGORY_JOB_OUTCOME } from "@brief/common/constants";
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

/** The body the publisher sends, and no `x-death` — a first delivery. */
const message = () =>
	({
		content: Buffer.from(JSON.stringify({ id: JOB_ID })),
		properties: { headers: {} },
		fields: {},
	}) as never;

const consumer = () => {
	const instance = new CategoryConsumer(
		"category-test",
		"amqp://localhost",
		"category_jobs",
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

	return {
		handle: () =>
			(
				instance as unknown as {
					handleMessage: (c: unknown, m: unknown) => Promise<void>;
				}
			).handleMessage(channel, message()),
		logger: vi.spyOn(
			(instance as unknown as { logger: Record<string, () => void> }).logger,
			"error",
		),
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
