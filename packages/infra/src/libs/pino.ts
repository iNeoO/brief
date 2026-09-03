import process from "node:process";
import pino from "pino";
import pretty from "pino-pretty";

const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

type Level = (typeof LEVELS)[number];

const isLevel = (value: string | undefined): value is Level =>
	LEVELS.includes(value as Level);

/**
 * Services and workers stay at `info`. LOG_LEVEL turns the volume up without a
 * code change; an unknown value is ignored rather than crashing a worker at
 * boot over a typo in an env file.
 */
const configuredLevel = (fallback: Level): Level =>
	isLevel(process.env.LOG_LEVEL) ? process.env.LOG_LEVEL : fallback;

const createDefaultConfig = (): pino.LoggerOptions => {
	return {
		level: configuredLevel("info"),
		serializers: {
			err: pino.stdSerializers.err,
		},
	};
};

const isProduction = process.env.NODE_ENV === "production";

export const pinoLogger = isProduction
	? pino(createDefaultConfig())
	: pino(createDefaultConfig(), pretty());

type HttpLogBindings = {
	reqId: string;
	req: {
		method: string;
		url: string;
	};
	userAgent: string;
};

export const createHttpLogger = (bindings: HttpLogBindings) =>
	pinoLogger.child(bindings);

export const logHttpCompletion = (
	logger: pino.Logger,
	status: number,
	responseTime: number,
) =>
	logger.info(
		{
			res: {
				status,
			},
			responseTime,
		},
		"Request completed",
	);

type WorkerBindings = {
	workerId: string;
	reqId?: string;
};

export const createWorkerLogger = (bindings: WorkerBindings) =>
	pinoLogger.child(bindings);

/**
 * For the hand-run scripts, where seeing what the model produced is the whole
 * point. Defaults to `debug` instead of `info`, and still obeys LOG_LEVEL.
 */
export const createCliLogger = (bindings: Record<string, string>) =>
	pinoLogger.child(bindings, { level: configuredLevel("debug") });

type SchedulerBindings = {
	schedulerId: string;
	date: string;
};

export const createSchedulerLogger = (bindings: SchedulerBindings) =>
	pinoLogger.child(bindings);

export type PinoLogger = pino.Logger;
