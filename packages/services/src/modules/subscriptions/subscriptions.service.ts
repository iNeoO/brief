import { DOMAIN_ERROR_CODE } from "@brief/common/constants";
import { and, type Database, eq, schema } from "@brief/drizzle";
import { DomainError } from "@brief/infra/errors";
import type {
	GetMySubscriptionsInput,
	SubscriptionTarget,
} from "./subscriptions.type.js";

export class SubscriptionsService {
	constructor(private db: Database) {}

	async getMySubscriptions({ userId }: GetMySubscriptionsInput) {
		return await this.db.query.subscriptions.findMany({
			where: { userId },
			with: { category: true },
		});
	}

	async subscribe({ userId, categoryId }: SubscriptionTarget) {
		const category = await this.db.query.categories.findFirst({
			columns: { id: true, isEnable: true },
			where: { id: categoryId },
		});

		if (!category) {
			throw new DomainError({
				code: DOMAIN_ERROR_CODE.SUBSCRIPTION_CATEGORY_NOT_FOUND,
				message: `Category ${categoryId} does not exist`,
			});
		}

		if (!category.isEnable) {
			throw new DomainError({
				code: DOMAIN_ERROR_CODE.SUBSCRIPTION_CATEGORY_DISABLED,
				message: `Category ${categoryId} is disabled`,
			});
		}

		await this.db
			.insert(schema.subscriptions)
			.values({ userId, categoryId })
			.onConflictDoNothing();
	}

	async unsubscribe({ userId, categoryId }: SubscriptionTarget) {
		await this.db
			.delete(schema.subscriptions)
			.where(
				and(
					eq(schema.subscriptions.userId, userId),
					eq(schema.subscriptions.categoryId, categoryId),
				),
			);
	}
}
