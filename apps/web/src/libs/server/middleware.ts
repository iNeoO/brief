import { createMiddleware } from "@tanstack/react-start";
import { getContainer } from "./container";
import { errorHandlingMiddleware } from "./error-handling";
import { createUnauthorizedError } from "./errors";
import { getRequestHeadersAsHeaders } from "./headers";

export const containerMiddleware = createMiddleware({ type: "function" })
	.middleware([errorHandlingMiddleware])
	.server(({ next }) => next({ context: { container: getContainer() } }));

export const authedMiddleware = createMiddleware({ type: "function" })
	.middleware([containerMiddleware])
	.server(async ({ next, context }) => {
		const session = await context.container.authService.getSession({
			headers: getRequestHeadersAsHeaders(),
		});

		if (!session?.user?.id) {
			throw createUnauthorizedError();
		}

		return next({ context: { user: session.user } });
	});
