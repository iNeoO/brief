import type amqp from "amqplib";

export const queueTopology = (queue: string) => ({
	dlx: `${queue}.dlx`,
	dlq: `${queue}.dlq`,
	dlRoutingKey: `${queue}.dead`,
	retry: `${queue}.retry`,
});

export const assertQueueTopology = async (
	channel: amqp.Channel,
	queue: string,
) => {
	const { dlx, dlq, dlRoutingKey } = queueTopology(queue);

	await channel.assertExchange(dlx, "direct", { durable: true });
	await channel.assertQueue(dlq, { durable: true });
	await channel.bindQueue(dlq, dlx, dlRoutingKey);
	await channel.assertQueue(queue, {
		durable: true,
		arguments: {
			"x-dead-letter-exchange": dlx,
			"x-dead-letter-routing-key": dlRoutingKey,
		},
	});
};

/**
 * A holding queue for a message that failed and deserves another try later. It
 * has no consumer: a message published here sits for its own `expiration`, then
 * dead-letters straight back into `queue` through the default exchange.
 *
 * The delay is carried per message rather than by the queue, which is what lets a
 * 429's own `retry_after` be honoured instead of a fixed figure. The known cost:
 * a single queue expires messages in publication order, so a long delay at the
 * head holds back a short one behind it. Harmless at one message per reader per
 * topic per day; the way out, if it ever bites, is fixed-delay tiers.
 *
 * Asserted separately from `assertQueueTopology` so the workers that have no use
 * for it do not grow a queue nobody reads.
 */
export const assertRetryTopology = async (
	channel: amqp.Channel,
	queue: string,
) => {
	await channel.assertQueue(queueTopology(queue).retry, {
		durable: true,
		arguments: {
			// The default exchange routes by queue name, so this lands the message
			// back where it came from with no exchange of our own in between.
			"x-dead-letter-exchange": "",
			"x-dead-letter-routing-key": queue,
		},
	});
};

/**
 * How many times this message has already come back through the holding queue.
 *
 * RabbitMQ keeps the tally itself: every dead-letter hop appends or increments an
 * `x-death` entry, keyed by the queue and the reason it left it. Reading it is
 * what lets a caller cap a retry cycle whose own bookkeeping no longer applies —
 * a job already finished, say — instead of deferring the same message forever.
 *
 * All the deferrals for one queue share the holding queue, so the figure counts
 * every kind of retry that passed through it, not one particular cycle.
 */
export const retryDeathCount = (msg: amqp.ConsumeMessage, queue: string) => {
	const deaths = msg.properties.headers?.["x-death"];
	if (!Array.isArray(deaths)) return 0;

	const { retry } = queueTopology(queue);
	const entry = deaths.find(
		(death: unknown): death is { count: unknown } =>
			typeof death === "object" &&
			death !== null &&
			(death as { queue?: unknown }).queue === retry,
	);

	return typeof entry?.count === "number" ? entry.count : 0;
};
