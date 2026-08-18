import { Redis } from "ioredis";

export type RedisClient = Redis;

export const createRedis = (url: string): RedisClient =>
	new Redis(url, {
		// Buffer commands issued before the initial connection is established,
		// otherwise the first request after a cold start fails. maxRetriesPerRequest
		// still makes queued commands fail fast when Redis is actually down.
		enableOfflineQueue: true,
		maxRetriesPerRequest: 3,
	});
