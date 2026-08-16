import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authedMiddleware } from "#/libs/server/middleware";

const subscriptionInput = z.object({
	categoryId: z.uuid(),
});

export const getMySubscriptions = createServerFn({ method: "GET" })
	.middleware([authedMiddleware])
	.handler(({ context }) =>
		context.container.subscriptionsService.getMySubscriptions({
			userId: context.user.id,
		}),
	);

export const subscribe = createServerFn({ method: "POST" })
	.middleware([authedMiddleware])
	.validator(subscriptionInput)
	.handler(async ({ data, context }) => {
		await context.container.subscriptionsService.subscribe({
			userId: context.user.id,
			categoryId: data.categoryId,
		});

		return { success: true };
	});

export const unsubscribe = createServerFn({ method: "POST" })
	.middleware([authedMiddleware])
	.validator(subscriptionInput)
	.handler(async ({ data, context }) => {
		await context.container.subscriptionsService.unsubscribe({
			userId: context.user.id,
			categoryId: data.categoryId,
		});

		return { success: true };
	});
