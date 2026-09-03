import type amqp from "amqplib";

export const queueTopology = (queue: string) => ({
	dlx: `${queue}.dlx`,
	dlq: `${queue}.dlq`,
	dlRoutingKey: `${queue}.dead`,
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
