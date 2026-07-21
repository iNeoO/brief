import amqp from "amqplib";
import { createWorkerLogger, type PinoLogger } from "../libs/index.js";
import { assertQueueTopology } from "./topology.js";

export type AmqpPublisherOptions = {
	id: string;
	url: string;
	queue: string;
	heartbeatSeconds?: number;
};

export class AmqpPublisher {
	private readonly id: string;
	private readonly url: string;
	private readonly queue: string;
	private readonly heartbeatSeconds: number;
	private readonly logger: PinoLogger;

	private connection?: amqp.ChannelModel;
	private channel?: amqp.Channel;
	private connectPromise?: Promise<amqp.Channel>;

	constructor(options: AmqpPublisherOptions) {
		this.id = options.id;
		this.url = options.url;
		this.queue = options.queue;
		this.heartbeatSeconds = options.heartbeatSeconds ?? 30;
		this.logger = createWorkerLogger({ workerId: this.id });
	}

	async init() {
		await this.ensureChannel();
	}

	async publish(message: unknown) {
		const channel = await this.ensureChannel();
		const payload = Buffer.from(JSON.stringify(message));

		const ok = channel.sendToQueue(this.queue, payload, { persistent: true });
		if (!ok) {
			await new Promise<void>((resolve) => channel.once("drain", resolve));
		}
	}

	private connectUrl() {
		const url = new URL(this.url);
		url.searchParams.set("heartbeat", String(this.heartbeatSeconds));
		return url.toString();
	}

	private ensureChannel(): Promise<amqp.Channel> {
		if (this.channel) {
			return Promise.resolve(this.channel);
		}

		if (!this.connectPromise) {
			this.connectPromise = this.connect().finally(() => {
				this.connectPromise = undefined;
			});
		}

		return this.connectPromise;
	}

	private async connect(): Promise<amqp.Channel> {
		const connection = await amqp.connect(this.connectUrl());
		this.connection = connection;

		connection.on("error", (err) => {
			this.logger.error({ err }, "connection error");
		});
		connection.on("close", () => {
			if (this.connection === connection) {
				this.connection = undefined;
				this.channel = undefined;
			}
		});

		const channel = await connection.createChannel();
		this.channel = channel;

		channel.on("error", (err) => {
			this.logger.error({ err }, "channel error");
		});
		channel.on("close", () => {
			if (this.channel === channel) {
				this.channel = undefined;
			}
		});

		await assertQueueTopology(channel, this.queue);

		return channel;
	}

	async close() {
		if (this.channel) {
			try {
				await this.channel.close();
			} catch (err) {
				this.logger.debug({ err }, "failed to close AMQP channel");
			}
			this.channel = undefined;
		}

		if (this.connection) {
			try {
				await this.connection.close();
			} catch (err) {
				this.logger.debug({ err }, "failed to close AMQP connection");
			}
			this.connection = undefined;
		}
	}
}
