import { Redis } from "ioredis";

export type RedisClient = Redis;

export const createRedis = (url: string): RedisClient =>
	new Redis(url, {
		maxRetriesPerRequest: 3,
		enableOfflineQueue: false,
	});
