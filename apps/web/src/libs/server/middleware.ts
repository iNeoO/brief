import { USER_ROLE } from "@brief/common/constants";
import { createMiddleware } from "@tanstack/react-start";
import { getContainer } from "./container";
import { errorHandlingMiddleware } from "./error-handling";
import { createForbiddenError, createUnauthorizedError } from "./errors";
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

/**
 * Server-side counterpart of the `requireAdmin` route guard, which only decides
 * what gets rendered. The role comes from the session, so a demotion takes
 * effect at the end of Better Auth's cookie cache window at the latest.
 */
export const adminMiddleware = createMiddleware({ type: "function" })
	.middleware([authedMiddleware])
	.server(({ next, context }) => {
		if (context.user.role !== USER_ROLE.ADMIN) {
			throw createForbiddenError();
		}

		return next({ context: { user: context.user } });
	});
