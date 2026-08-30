import { createDb } from "@brief/drizzle";
import { createRedis } from "@brief/infra/redis";
import {
	BriefsService,
	CategoriesService,
	createS3Config,
	PipelineMetricsService,
	ProvidersService,
	S3Service,
	SubscriptionsService,
	TelegramClient,
	TelegramPairingService,
} from "@brief/services";
import { AuthService } from "@brief/services/auth";
import { MailService } from "@brief/services/mail";
import { createServerOnlyFn } from "@tanstack/react-start";
import { env } from "#/config/env";

const createContainer = () => {
	const db = createDb(env.PG_URL);
	const redis = createRedis(env.REDIS_URL);

	const telegramConfig = {
		botToken: env.TELEGRAM_BOT_TOKEN,
		botUsername: env.TELEGRAM_BOT_USERNAME,
	};

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
				adminUserIds: env.ADMIN_USER_IDS,
			},
		}),
		briefsService: new BriefsService(db),
		categoriesService: new CategoriesService(db),
		pipelineMetricsService: new PipelineMetricsService(db),
		providersService: new ProvidersService(db),
		subscriptionsService: new SubscriptionsService(db),
		telegramPairingService: new TelegramPairingService(
			db,
			redis,
			telegramConfig,
			new TelegramClient(telegramConfig),
		),
		s3Service: new S3Service(db, createS3Config(env)),
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
