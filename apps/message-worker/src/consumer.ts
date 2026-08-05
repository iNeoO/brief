import {
	type AmqpChannel,
	type AmqpMessage,
	BaseAmqpConsumer,
	safeParseMessageJobMessage,
} from "@brief/infra/amqp";

export class MessageConsumer extends BaseAmqpConsumer {
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

		this.logger.warn(
			{ messageJobId: result.data.id },
			"message delivery is not implemented, skipping",
		);
		channel.ack(msg);
	}
}
