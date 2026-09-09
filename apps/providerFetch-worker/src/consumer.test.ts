import { JOB_STATUS } from "@brief/common/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderFetchConsumer } from "./consumer.js";

const JOB_ID = 7;
const CATEGORY_JOB_ID = 42;
const TARGET_DATE = new Date("2026-09-09T00:00:00.000Z");

const claimJob = vi.fn();
const markFinished = vi.fn();
const incrementRetry = vi.fn();
const findWaitingByProviderFetchJob = vi.fn();
const releaseWaitingJob = vi.fn();
const ingestProvider = vi.fn();
const publishCategory = vi.fn();
const publishRetry = vi.fn();

const channel = {
	ack: vi.fn(),
	nack: vi.fn(),
};

const QUEUE = "provider_fetch_jobs";

const message = () =>
	({
		content: Buffer.from(JSON.stringify({ id: JOB_ID })),
		properties: { headers: {} },
		fields: {},
	}) as never;

const consumer = (msg: unknown = message()) => {
	const instance = new ProviderFetchConsumer(
		"provider-fetch-test",
		"amqp://localhost",
		QUEUE,
		"provider-fetch",
		{
			providersService: {},
			providerFetchJobsService: { claimJob, markFinished, incrementRetry },
			categoryJobsService: {
				findWaitingByProviderFetchJob,
				releaseWaitingJob,
			},
			ingestionService: { ingestProvider },
			categoryPublisher: { publish: publishCategory },
			retryPublisher: { publish: publishRetry },
		} as never,
	);

	const logger = (instance as unknown as { logger: Record<string, () => void> })
		.logger;

	return {
		handle: () =>
			(
				instance as unknown as {
					handleMessage: (c: unknown, m: unknown) => Promise<void>;
				}
			).handleMessage(channel, msg),
		errors: vi.spyOn(logger, "error"),
		warnings: vi.spyOn(logger, "warn"),
	};
};

const dependent = {
	id: CATEGORY_JOB_ID,
	targetDate: TARGET_DATE,
	category: "Économie",
};

beforeEach(() => {
	vi.clearAllMocks();
	claimJob.mockResolvedValue({
		id: JOB_ID,
		provider: { id: "provider-1", slug: "rfi", kind: "rss" },
	});
	ingestProvider.mockResolvedValue(3);
	markFinished.mockResolvedValue([{ id: JOB_ID }]);
	findWaitingByProviderFetchJob.mockResolvedValue([dependent]);
	releaseWaitingJob.mockResolvedValue({
		outcome: "ready",
		failedProviders: [],
	});
	publishCategory.mockResolvedValue(undefined);
	publishRetry.mockResolvedValue(undefined);
});

describe("handleMessage", () => {
	it("finishes the fetch and releases the category waiting on it", async () => {
		await consumer().handle();

		expect(ingestProvider).toHaveBeenCalledOnce();
		expect(markFinished).toHaveBeenCalledWith(JOB_ID);
		expect(releaseWaitingJob).toHaveBeenCalledWith(CATEGORY_JOB_ID);
		expect(publishCategory).toHaveBeenCalledWith({ id: CATEGORY_JOB_ID });
		expect(channel.ack).toHaveBeenCalledOnce();
	});

	it("settles the dependents when the fetch dies for good", async () => {
		ingestProvider.mockRejectedValue(new Error("404 Not Found"));
		incrementRetry.mockResolvedValue({
			status: JOB_STATUS.FAILED,
			retry: 3,
		});
		releaseWaitingJob.mockResolvedValue({
			outcome: "ready",
			failedProviders: ["RFI"],
		});

		const c = consumer();
		await c.handle();

		expect(releaseWaitingJob).toHaveBeenCalledWith(CATEGORY_JOB_ID);
		expect(publishCategory).toHaveBeenCalledWith({ id: CATEGORY_JOB_ID });
		expect(c.warnings).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId: CATEGORY_JOB_ID,
				category: "Économie",
				failedProviders: ["RFI"],
			}),
			expect.stringContaining("without every source"),
		);
		expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
	});

	it("warns from the success path when the last dependency to land is the good one", async () => {
		releaseWaitingJob.mockResolvedValue({
			outcome: "ready",
			failedProviders: ["RFI"],
		});

		const c = consumer();
		await c.handle();

		expect(markFinished).toHaveBeenCalledWith(JOB_ID);
		expect(c.warnings).toHaveBeenCalledWith(
			expect.objectContaining({ failedProviders: ["RFI"] }),
			expect.stringContaining("without every source"),
		);
		expect(channel.ack).toHaveBeenCalledOnce();
	});

	it("fails the category when no provider produced anything", async () => {
		ingestProvider.mockRejectedValue(new Error("404 Not Found"));
		incrementRetry.mockResolvedValue({ status: JOB_STATUS.FAILED, retry: 3 });
		releaseWaitingJob.mockResolvedValue({
			outcome: "failed",
			failedProviders: ["RFI", "France 24"],
			error: "no_candidate_articles: no provider produced an article",
		});

		const c = consumer();
		await c.handle();

		expect(publishCategory).not.toHaveBeenCalled();
		expect(c.errors).toHaveBeenCalledWith(
			expect.objectContaining({
				jobId: CATEGORY_JOB_ID,
				failedProviders: ["RFI", "France 24"],
			}),
			expect.stringContaining("no provider produced an article"),
		);
	});

	it("does not touch the gate while the fetch still has retries left", async () => {
		ingestProvider.mockRejectedValue(new Error("502"));
		incrementRetry.mockResolvedValue({ status: JOB_STATUS.PENDING, retry: 1 });

		await consumer().handle();

		expect(releaseWaitingJob).not.toHaveBeenCalled();
		expect(publishRetry).toHaveBeenCalledWith(
			{ id: JOB_ID },
			expect.objectContaining({ delayMs: expect.any(Number) }),
		);
	});

	it("resolves the dependents on a redelivery it can no longer claim", async () => {
		claimJob.mockResolvedValue(undefined);

		await consumer().handle();

		expect(ingestProvider).not.toHaveBeenCalled();
		expect(releaseWaitingJob).toHaveBeenCalledWith(CATEGORY_JOB_ID);
		expect(channel.ack).toHaveBeenCalledOnce();
	});

	it("publishes only the dependents the gate actually released", async () => {
		findWaitingByProviderFetchJob.mockResolvedValue([
			dependent,
			{ ...dependent, id: 43, category: "Sport" },
		]);
		releaseWaitingJob
			.mockResolvedValueOnce({ outcome: "ready", failedProviders: [] })
			.mockResolvedValueOnce({ outcome: "waiting" });

		await consumer().handle();

		expect(publishCategory).toHaveBeenCalledExactlyOnceWith({
			id: CATEGORY_JOB_ID,
		});
	});

	it("keeps the fetch finished when the gate itself throws", async () => {
		releaseWaitingJob.mockRejectedValue(new Error("connection reset"));

		await consumer().handle();

		expect(incrementRetry).not.toHaveBeenCalled();
		expect(publishRetry).toHaveBeenCalledOnce();
		expect(channel.nack).not.toHaveBeenCalled();
	});

	it("defers rather than losing the message when the gate throws after a failure", async () => {
		ingestProvider.mockRejectedValue(new Error("404 Not Found"));
		incrementRetry.mockResolvedValue({ status: JOB_STATUS.FAILED, retry: 3 });
		releaseWaitingJob.mockRejectedValue(new Error("connection reset"));

		await consumer().handle();

		expect(publishRetry).toHaveBeenCalledOnce();
		expect(channel.nack).not.toHaveBeenCalled();
	});

	it("dead-letters a message it cannot parse", async () => {
		const broken = {
			content: Buffer.from("not json"),
			properties: { headers: {} },
			fields: {},
		} as never;

		await consumer(broken).handle();

		expect(claimJob).not.toHaveBeenCalled();
		expect(channel.nack).toHaveBeenCalledWith(broken, false, false);
	});
});
