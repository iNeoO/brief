import { pinoLogger } from "@brief/infra/libs";
import type { RedisClient } from "@brief/infra/redis";
import { getRequestIP } from "@tanstack/react-start/server";
import { createTooManyRequestsError } from "./errors";

const KEY_PREFIX = "brief:rl:";

type Rule = { limit: number; windowSeconds: number };

const RULES = {
	signIn: {
		ip: { limit: 30, windowSeconds: 300 },
		email: { limit: 10, windowSeconds: 900 },
	},
	signUp: {
		ip: { limit: 10, windowSeconds: 3600 },
		email: { limit: 3, windowSeconds: 3600 },
	},
	requestPasswordReset: {
		ip: { limit: 10, windowSeconds: 3600 },
		email: { limit: 3, windowSeconds: 3600 },
	},
	sendVerificationEmail: {
		ip: { limit: 10, windowSeconds: 3600 },
		email: { limit: 3, windowSeconds: 3600 },
	},
	changePassword: {
		ip: { limit: 20, windowSeconds: 3600 },
		email: { limit: 10, windowSeconds: 900 },
	},
	// Each link mints a pairing code that stays live for its whole window, so a
	// loop would leave hundreds of them valid at once. Pairing is something a
	// reader does once, and retries a handful of times at worst.
	createTelegramPairingLink: {
		ip: { limit: 20, windowSeconds: 3600 },
		email: { limit: 10, windowSeconds: 3600 },
	},
} as const satisfies Record<string, { ip: Rule; email: Rule }>;

export type RateLimitedAction = keyof typeof RULES;

const consume = async (
	redis: RedisClient,
	action: RateLimitedAction,
	key: string,
	rule: Rule,
) => {
	let count: number;

	try {
		const results = await redis
			.multi()
			.incr(key)
			.expire(key, rule.windowSeconds, "NX")
			.exec();

		const [error, value] = results?.[0] ?? [];

		if (error) {
			throw error;
		}

		count = Number(value);
	} catch (error) {
		pinoLogger.error({ err: error, action }, "Rate limit check failed");
		throw createTooManyRequestsError();
	}

	if (!Number.isFinite(count) || count > rule.limit) {
		throw createTooManyRequestsError();
	}
};

export const enforceAuthRateLimit = async (
	redis: RedisClient,
	action: RateLimitedAction,
	email: string,
) => {
	const rule = RULES[action];
	const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";

	await Promise.all([
		consume(redis, action, `${KEY_PREFIX}${action}:ip:${ip}`, rule.ip),
		consume(
			redis,
			action,
			`${KEY_PREFIX}${action}:email:${email.toLowerCase()}`,
			rule.email,
		),
	]);
};
