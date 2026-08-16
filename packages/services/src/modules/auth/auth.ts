import { redisStorage } from "@better-auth/redis-storage";
import { AUTH_PATH, USER_ROLE } from "@brief/common/constants";
import { type Database, schema } from "@brief/drizzle";
import type { RedisClient } from "@brief/infra/redis";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import type { MailService } from "../mail/mail.service.js";
import type { AuthConfig } from "./auth.type.js";

const buildAppUrl = ({
	sourceUrl,
	baseUrl,
	path,
	token,
}: {
	sourceUrl: string;
	baseUrl: string;
	path: string;
	token: string;
}) => {
	const source = new URL(sourceUrl);
	const target = new URL(path, baseUrl);

	target.searchParams.set("token", token);

	const callbackUrl = source.searchParams.get("callbackURL");
	if (callbackUrl) {
		target.searchParams.set("callbackURL", callbackUrl);
	}

	return target.toString();
};

export type CreateAuthOptions = {
	db: Database;
	redis: RedisClient;
	mailService: MailService;
	config: AuthConfig;
};

export const createAuth = ({
	db,
	redis,
	mailService,
	config,
}: CreateAuthOptions) =>
	betterAuth({
		secret: config.secret,
		baseURL: config.url,
		database: drizzleAdapter(db, {
			provider: "pg",
			schema,
		}),
		secondaryStorage: redisStorage({
			client: redis,
			keyPrefix: config.redisKeyPrefix,
		}),
		session: {
			cookieCache: {
				enabled: true,
				maxAge: 5 * 60,
			},
		},
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			sendResetPassword: ({ user, url, token }) =>
				mailService.sendResetPasswordEmail({
					to: user.email,
					name: user.name,
					url: buildAppUrl({
						sourceUrl: url,
						baseUrl: config.url,
						path: AUTH_PATH.RESET_PASSWORD,
						token,
					}),
				}),
		},
		emailVerification: {
			sendOnSignUp: true,
			sendVerificationEmail: ({ user, url, token }) =>
				mailService.sendVerificationEmail({
					to: user.email,
					name: user.name,
					url: buildAppUrl({
						sourceUrl: url,
						baseUrl: config.url,
						path: AUTH_PATH.VERIFY_EMAIL,
						token,
					}),
				}),
		},
		plugins: [
			admin({
				defaultRole: USER_ROLE.USER,
				adminRoles: [USER_ROLE.ADMIN],
			}),
		],
	});

export type AppAuth = ReturnType<typeof createAuth>;
