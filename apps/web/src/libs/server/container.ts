import { createDb } from "@brief/drizzle";
import { createRedis } from "@brief/infra/redis";
import { CategoriesService, SubscriptionsService } from "@brief/services";
import { AuthService } from "@brief/services/auth";
import { MailService } from "@brief/services/mail";
import { createServerOnlyFn } from "@tanstack/react-start";
import { env } from "#/config/env";

const createContainer = () => {
	const db = createDb();
	const redis = createRedis(env.REDIS_URL);

	const mailService = new MailService({
		apiKey: env.RESEND_API_KEY,
		from: env.RESEND_FROM_EMAIL,
		nodeEnv: env.NODE_ENV,
	});

	return {
		db,
		redis,
		mailService,
		authService: new AuthService({
			db,
			redis,
			mailService,
			config: {
				secret: env.BETTER_AUTH_SECRET,
				url: env.BETTER_AUTH_URL,
				redisKeyPrefix: env.BETTER_AUTH_REDIS_KEY_PREFIX,
			},
		}),
		categoriesService: new CategoriesService(db),
		subscriptionsService: new SubscriptionsService(db),
	};
};

export type Container = ReturnType<typeof createContainer>;

const CONTAINER_KEY = Symbol.for("@brief/web/container");

type GlobalWithContainer = typeof globalThis & {
	[CONTAINER_KEY]?: Container;
};

export const getContainer = createServerOnlyFn((): Container => {
	const globalWithContainer = globalThis as GlobalWithContainer;

	globalWithContainer[CONTAINER_KEY] ??= createContainer();

	return globalWithContainer[CONTAINER_KEY];
});
