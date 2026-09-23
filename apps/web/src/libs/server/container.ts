import { createDb } from "@brief/drizzle";
import { createRedis } from "@brief/infra/redis";
import {
	AdminJobsService,
	type AdminStatsPricing,
	AdminStatsService,
	BriefsService,
	CategoriesService,
	createS3Config,
	PipelineMetricsService,
	ProvidersService,
	S3Service,
	SubscriptionsService,
	TelegramClient,
	TelegramPairingService,
	UsersService,
} from "@brief/services";
import { AuthService } from "@brief/services/auth";
import { MailService } from "@brief/services/mail";
import { createServerOnlyFn } from "@tanstack/react-start";
import { env } from "#/config/env";

/**
 * Both LLM prices or neither: a grid with only the prompt price filled in
 * would price half the tokens and present it as the LLM cost.
 */
const readPricing = (): AdminStatsPricing => ({
	...(env.LLM_PRICE_PROMPT_PER_MTOK !== undefined &&
		env.LLM_PRICE_COMPLETION_PER_MTOK !== undefined && {
			llm: {
				promptPerMillionTokens: env.LLM_PRICE_PROMPT_PER_MTOK,
				completionPerMillionTokens: env.LLM_PRICE_COMPLETION_PER_MTOK,
			},
		}),
	...(env.TTS_PRICE_PER_MCHAR !== undefined && {
		tts: { perMillionCharacters: env.TTS_PRICE_PER_MCHAR },
	}),
});

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
		adminJobsService: new AdminJobsService(db),
		adminStatsService: new AdminStatsService(db, readPricing()),
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
		usersService: new UsersService(db),
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
