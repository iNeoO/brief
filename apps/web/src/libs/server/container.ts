import { createDb } from "@brief/drizzle";
import { createRedis } from "@brief/infra/redis";
import {
	BriefsService,
	CategoriesService,
	ProvidersService,
	S3Service,
	SubscriptionsService,
	WhatsAppPairingService,
} from "@brief/services";
import { AuthService } from "@brief/services/auth";
import { MailService } from "@brief/services/mail";
import { createServerOnlyFn } from "@tanstack/react-start";
import { env } from "#/config/env";

const createContainer = () => {
	const db = createDb(env.PG_URL);
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
				adminUserIds: env.ADMIN_USER_IDS,
			},
		}),
		briefsService: new BriefsService(db),
		categoriesService: new CategoriesService(db),
		providersService: new ProvidersService(db),
		subscriptionsService: new SubscriptionsService(db),
		whatsappPairingService: new WhatsAppPairingService(db, redis, {
			senderNumber: env.WHATSAPP_SENDER_NUMBER,
			phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
			accessToken: env.WHATSAPP_ACCESS_TOKEN,
			apiVersion: env.WHATSAPP_API_VERSION,
		}),
		s3Service: new S3Service(db, {
			endpoint: `${env.S3_USE_SSL ? "https" : "http"}://${env.S3_ENDPOINT}:${env.S3_PORT}`,
			region: env.S3_REGION,
			bucket: env.S3_BUCKET,
			accessKeyId: env.S3_ACCESS_KEY,
			secretAccessKey: env.S3_SECRET_KEY,
		}),
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
