import { openApiResponse } from "@brief/infra/helpers";
import { describeRoute } from "hono-openapi";
import { healthSchema } from "./health.schema.js";

export const GetHealthRoute = describeRoute({
	responses: {
		...openApiResponse(healthSchema, 200, "Health status"),
	},
});
