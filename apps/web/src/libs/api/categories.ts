import { createServerFn } from "@tanstack/react-start";
import { authedMiddleware } from "#/libs/server/middleware";

export const getSubscribableCategories = createServerFn({ method: "GET" })
	.middleware([authedMiddleware])
	.handler(({ context }) =>
		context.container.categoriesService.getCategories({ isEnable: true }),
	);
