import { logMiddleware } from "@brief/infra/middlewares";
import { HealthService } from "@brief/services";
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { errorHandler } from "./helpers/errors.helper.js";
import { createHealthController } from "./modules/health/health.controller.js";
import type { AppServices } from "./services/container.js";

export const createApp = (services: AppServices) => {
	const healthService = new HealthService(services.db);
	return new Hono()
		.use(requestId())
		.use(logMiddleware)
		.use(secureHeaders())
		.route("health", createHealthController(healthService))
		.notFound((c) => {
			return c.json({ code: "NOT_FOUND", error: "Page not found" }, 404);
		})
		.onError(errorHandler);
};
