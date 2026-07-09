import amqp from "amqplib";
import { createWorkerLogger, type PinoLogger } from "../libs/index.js";

export type AmqpChannel = amqp.Channel;
export type AmqpMessage = amqp.ConsumeMessage;

const defaultRetryDelayMs = (attempt: number) => {
	const base = Math.min(1000 * 2 ** attempt, 30_000);
	return Math.round(base / 2 + Math.random() * (base / 2));
};

export type BaseAmqpConsumerOptions = {
	id: string;
	url: string;
	queue: string;
	name: string;
	prefetch?: number;
	retryDelayMs?: (attempt: number) => number;
	heartbeatSeconds?: number;
};

export abstract class BaseAmqpConsumer {
	protected readonly id: string;
	protected readonly queue: string;
	protected readonly url: string;
	protected readonly name: string;
	protected readonly logger: PinoLogger;

	private connection?: amqp.ChannelModel;
	private channel?: amqp.Channel;
	private consumerTag?: string;
	private shuttingDown = false;
	private attempt = 0;
	private reconnectTimer?: NodeJS.Timeout;
	private hasConnectedOnce = false;
	private inFlightTasks = new Set<Promise<void>>();
	private readonly prefetch: number;
	private readonly retryDelayMs: (attempt: number) => number;
	private readonly heartbeatSeconds: number;

	constructor(options: BaseAmqpConsumerOptions) {
		this.id = options.id;
		this.url = options.url;
		this.queue = options.queue;
		this.name = options.name;
		this.prefetch = options.prefetch ?? 5;
		this.retryDelayMs = options.retryDelayMs ?? defaultRetryDelayMs;
		this.heartbeatSeconds = options.heartbeatSeconds ?? 30;
		this.logger = createWorkerLogger({ workerId: this.id });
	}

	protected abstract handleMessage(
		channel: AmqpChannel,
		msg: AmqpMessage,
	): Promise<void>;

	async init() {
		if (this.shuttingDown) {
			throw new Error("consumer has been ended, create a new instance");
		}

		await this.initConsumer();
	}

	private connectUrl() {
		const url = new URL(this.url);

		url.searchParams.set("heartbeat", String(this.heartbeatSeconds));

		return url.toString();
	}

	private async initConsumer() {
		await this.closeStaleConnection();

		const connection = await amqp.connect(this.connectUrl());

		if (this.shuttingDown) {
			await this.safeClose(connection, "connection opened during shutdown");
			return;
		}

		this.connection = connection;

		connection.on("error", (err) => {
			this.logger.error({ err }, "connection error");
		});

		connection.on("close", () => {
			if (this.connection !== connection) {
				return;
			}

			this.connection = undefined;
			this.channel = undefined;
			this.handleDisconnect();
		});

		try {
			const channel = await connection.createChannel();
			this.channel = channel;

			channel.on("error", (err) => {
				this.logger.error({ err }, "channel error");
			});

			channel.on("close", () => {
				if (this.channel !== channel) {
					return;
				}

				this.channel = undefined;
				this.handleDisconnect();
			});

			const dlx = `${this.queue}.dlx`;
			const dlq = `${this.queue}.dlq`;
			const dlRoutingKey = `${this.queue}.dead`;

			await channel.assertExchange(dlx, "direct", {
				durable: true,
			});

			await channel.assertQueue(dlq, {
				durable: true,
			});

			await channel.bindQueue(dlq, dlx, dlRoutingKey);

			await channel.assertQueue(this.queue, {
				durable: true,
				arguments: {
					"x-dead-letter-exchange": dlx,
					"x-dead-letter-routing-key": dlRoutingKey,
				},
			});

			await channel.prefetch(this.prefetch);

			const consumer = await channel.consume(this.queue, (msg) => {
				if (!msg) {
					this.logger.warn({ queue: this.queue }, "consumer was cancelled");
					if (this.channel === channel) {
						this.handleDisconnect();
					}
					return;
				}

				this.trackTask(this.handleMessage(channel, msg));
			});

			this.consumerTag = consumer.consumerTag;
		} catch (err) {
			await this.closeStaleConnection();
			throw err;
		}

		this.attempt = 0;
		this.hasConnectedOnce = true;
	}

	private async closeStaleConnection() {
		const stale = this.connection;
		this.connection = undefined;
		this.channel = undefined;
		this.consumerTag = undefined;

		if (stale) {
			await this.safeClose(stale, "stale connection");
		}
	}

	private async safeClose(target: { close(): Promise<void> }, label: string) {
		try {
			await target.close();
		} catch (err) {
			// already closed or closing
			this.logger.debug({ err }, `failed to close ${label}`);
		}
	}

	private trackTask(task: Promise<void>) {
		const tracked = task
			.catch((err) => {
				this.logger.error({ err }, "unhandled error in handleMessage");
			})
			.finally(() => {
				this.inFlightTasks.delete(tracked);
			});

		this.inFlightTasks.add(tracked);
	}

	private handleDisconnect() {
		if (!this.hasConnectedOnce || this.shuttingDown || this.reconnectTimer) {
			return;
		}

		const delay = this.retryDelayMs(this.attempt);
		this.attempt += 1;

		this.logger.warn(
			{
				worker: this.name,
				queue: this.queue,
				attempt: this.attempt,
				delayMs: delay,
			},
			"reconnecting",
		);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = undefined;
			this.initConsumer().catch((err) => {
				this.logger.error({ err }, "Error in initConsumer reconnect");
				this.handleDisconnect();
			});
		}, delay);
	}

	async end() {
		this.shuttingDown = true;

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}

		if (this.channel && this.consumerTag) {
			try {
				await this.channel.cancel(this.consumerTag);
			} catch (err) {
				this.logger.warn({ err }, "failed to cancel consumer during shutdown");
			}
		}

		await Promise.all(this.inFlightTasks);

		if (this.channel) {
			await this.safeClose(this.channel, "channel during shutdown");
		}

		if (this.connection) {
			await this.safeClose(this.connection, "connection during shutdown");
		}
	}
}
