import {
	type AmqpChannel,
	type AmqpMessage,
	type AmqpPublisher,
	BaseAmqpConsumer,
	safeParseMessageJobMessage,
} from "@brief/infra/amqp";
import { wrapWithLogger } from "@brief/infra/libs";
import type {
	MessageDeliveryService,
	MessageJobsService,
} from "@brief/services";

type MessageConsumerOptions = {
	id: string;
	url: string;
	queue: string;
	name: string;
	deliveryService: MessageDeliveryService;
	messageJobsService: MessageJobsService;
	retryPublisher: AmqpPublisher;
};

export class MessageConsumer extends BaseAmqpConsumer {
	private deliveryService: MessageDeliveryService;
	private retryPublisher: AmqpPublisher;

	constructor(options: MessageConsumerOptions) {
		// One at a time: Telegram allows roughly one message per second to the same
		// chat, and the default five would have a reader's topics racing each other
		// into a 429.
		super({ ...options, prefetch: 1 });
		this.deliveryService = options.deliveryService;
		this.retryPublisher = options.retryPublisher;
	}

	protected async handleMessage(channel: AmqpChannel, msg: AmqpMessage) {
		const result = safeParseMessageJobMessage(msg.content);
		if (result.error) {
			this.logger.error(
				{ err: result.error, raw: msg.content.toString("utf-8") },
				"Error parsing queue message",
			);
			channel.nack(msg, false, false);
			return;
		}

		const messageJobId = result.data.id;

		// The delivery service and everything under it log through the async-local
		// store; without this they fall back to the process logger and warn about it
		// on every call.
		await wrapWithLogger(this.logger.child({ messageJobId }), async () => {
			try {
				await this.dispatch(channel, msg, messageJobId);
			} catch (err) {
				this.logger.error({ err, messageJobId }, "message job failed");
				// Only a database failure reaches here — the Telegram client returns a
				// verdict instead of throwing. The row is deliberately left alone: it
				// may already be claimed, and putting it back to `pending` would send
				// the brief twice if the failure happened after Telegram accepted it.
				// A row stranded in `running` sends nothing, which is the safer half of
				// that trade; a reaper for those can wait until there is volume.
				channel.nack(msg, false, true);
			}
		});
	}

	private async dispatch(
		channel: AmqpChannel,
		msg: AmqpMessage,
		messageJobId: number,
	) {
		const verdict = await this.deliveryService.deliver(messageJobId);

		switch (verdict.outcome) {
			case "sent":
				channel.ack(msg);
				return;

			case "skipped":
				this.logger.info({ messageJobId, reason: verdict.reason }, "skipped");
				channel.ack(msg);
				return;

			case "opted-out":
				// A reader who unsubscribed is not a poison message: there is nothing
				// to examine in a dead-letter queue.
				this.logger.info({ messageJobId }, "reader is no longer reachable");
				channel.ack(msg);
				return;

			case "retry":
				// Publish before acking. A crash in between duplicates the message,
				// which the claim absorbs; the reverse order would lose it.
				await this.retryPublisher.publish(
					{ id: messageJobId },
					{ delayMs: verdict.delayMs },
				);
				this.logger.warn(
					{ messageJobId, delayMs: verdict.delayMs },
					"delivery deferred",
				);
				channel.ack(msg);
				return;

			case "failed":
				this.logger.error(
					{ messageJobId, reason: verdict.reason },
					"delivery failed for good",
				);
				channel.nack(msg, false, false);
				return;
		}
	}
}
