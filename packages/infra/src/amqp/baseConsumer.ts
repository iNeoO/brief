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
	private attempt = 0;
	private reconnectTimer?: NodeJS.Timeout;
	private hasConnectedOnce = false;
	private connectionPromise?: Promise<void>;
	private shutdownPromise?: Promise<void>;
	private status:
		| "off"
		| "connecting"
		| "running"
		| "reconnecting"
		| "shutting-down"
		| "ended" = "off";
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
		if (this.status !== "off") {
			throw new Error(
				`Consumer is not in status: off (actual status: ${this.status})`,
			);
		}
		this.status = "connecting";

		try {
			await this.runConnectConsumer();
		} catch (err) {
			if (this.status === "connecting") {
				this.status = "off";
			}

			throw err;
		}
	}

	private async runConnectConsumer() {
		const connectionPromise = this.connectConsumer();
		this.connectionPromise = connectionPromise;

		try {
			await connectionPromise;
		} finally {
			if (this.connectionPromise === connectionPromise) {
				this.connectionPromise = undefined;
			}
		}
	}

	private connectUrl() {
		const url = new URL(this.url);
		url.searchParams.set("heartbeat", String(this.heartbeatSeconds));
		return url.toString();
	}

	private async connectConsumer() {
		const connectingStatus = this.status;

		await this.closeStaleConnection();
		const connection = await amqp.connect(this.connectUrl());

		// Shutdown may have started while the connection was opening.
		if (this.status !== connectingStatus) {
			await this.safeClose(connection);
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

		let configuredChannel: amqp.Channel | undefined;

		try {
			const channel = await connection.createChannel();
			configuredChannel = channel;
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

				this.trackTask(
					Promise.resolve().then(() => this.handleMessage(channel, msg)),
				);
			});
			this.consumerTag = consumer.consumerTag;
		} catch (err) {
			await this.closeStaleConnection();
			throw err;
		}
		// Shutdown may have started while the consumer was being configured.
		if (this.status !== connectingStatus) {
			await this.closeStaleConnection();
			return;
		}

		if (this.connection !== connection || this.channel !== configuredChannel) {
			await this.closeStaleConnection();
			throw new Error("AMQP resources closed while configuring consumer");
		}

		this.status = "running";
		this.attempt = 0;
		this.hasConnectedOnce = true;
	}

	private async closeStaleConnection() {
		const stale = this.connection;
		this.connection = undefined;
		this.channel = undefined;
		this.consumerTag = undefined;

		if (stale) {
			await this.safeClose(stale);
		}
	}

	private async safeClose(target: amqp.Channel | amqp.ChannelModel) {
		try {
			await target.close();
		} catch (err) {
			this.logger.debug({ err }, "failed to close AMQP resource");
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
		if (
			!this.hasConnectedOnce ||
			this.status === "shutting-down" ||
			this.status === "ended" ||
			this.reconnectTimer ||
			this.connectionPromise
		) {
			return;
		}

		this.status = "reconnecting";

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
			this.runConnectConsumer().catch((err) => {
				this.logger.error({ err }, "Error in initConsumer reconnect");
				this.handleDisconnect();
			});
		}, delay);
	}

	end() {
		if (this.shutdownPromise) {
			return this.shutdownPromise;
		}

		this.shutdownPromise = this.shutdown().finally(() => {
			this.shutdownPromise = undefined;
		});

		return this.shutdownPromise;
	}

	private async shutdown(): Promise<void> {
		this.status = "shutting-down";

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}

		if (this.connectionPromise) {
			try {
				await this.connectionPromise;
			} catch (err) {
				this.logger.debug({ err }, "connection attempt failed during shutdown");
			}
		}

		if (this.channel && this.consumerTag) {
			try {
				await this.channel.cancel(this.consumerTag);
			} catch (err) {
				this.logger.warn({ err }, "failed to cancel consumer during shutdown");
			}
		}

		while (this.inFlightTasks.size > 0) {
			await Promise.all(this.inFlightTasks);
		}

		if (this.channel) {
			await this.safeClose(this.channel);
		}

		if (this.connection) {
			await this.safeClose(this.connection);
		}

		this.channel = undefined;
		this.connection = undefined;
		this.consumerTag = undefined;
		this.status = "ended";
	}
}
