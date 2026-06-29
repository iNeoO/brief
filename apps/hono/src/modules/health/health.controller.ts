import { appWithLogs } from "@brief/infra/factories";
import type { HealthService } from "@brief/services";
import { GetHealthRoute } from "./health.route.js";
import type { HealTthResponseApi } from "./health.type.js";

export const createHealthController = (healthService: HealthService) => {
	return appWithLogs.createApp().get("/", GetHealthRoute, async (c) => {
		const status = await healthService.getHealth();
		const response: HealTthResponseApi = { data: status };

		return c.json(response, 200);
	});
};
