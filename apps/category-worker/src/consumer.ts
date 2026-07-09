import {
	type AmqpChannel,
	type AmqpMessage,
	BaseAmqpConsumer,
} from "@brief/infra/amqp";

export class CategoryConsumer extends BaseAmqpConsumer {
	constructor(id: string, url: string, queue: string, name: string) {
		super({ id, url, queue, name });
	}

	protected async handleMessage(channel: AmqpChannel, msg: AmqpMessage) {}
}
