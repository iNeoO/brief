import { getLoggerStore } from "@brief/infra/libs";
import { createFileRoute } from "@tanstack/react-router";
import { getContainer } from "#/libs/server/container";
import { withRequestLogger } from "#/libs/server/logger";
import {
	metricsContentType,
	renderMetrics,
	setPipelineGauges,
} from "#/libs/server/metrics";

/**
 * Prometheus scrape endpoint, all series prefixed `brief_web_`.
 *
 * There is no authentication here, deliberately: the scrape reaches this
 * container over the internal `monitoring-shared` network, and the public
 * reverse proxy is the one that must refuse `/metrics` from the outside. See
 * the Observability section of the README.
 */
export const Route = createFileRoute("/metrics")({
	server: {
		handlers: {
			GET: ({ request }) =>
				withRequestLogger(
					{ route: new URL(request.url).pathname },
					async () => {
						const container = getContainer();

						try {
							setPipelineGauges(
								await container.pipelineMetricsService.getDailyCounts(
									new Date(),
								),
							);
						} catch (err) {
							// A database that is down must not blank the scrape: the process
							// metrics and the HTTP histogram are exactly what tells you the app
							// is still up, and the pipeline gauges simply keep their last value.
							getLoggerStore().warn(
								{ err },
								"Could not refresh the pipeline gauges",
							);
						}

						return new Response(await renderMetrics(), {
							headers: {
								"Content-Type": metricsContentType,
								"Cache-Control": "no-store",
							},
						});
					},
				),
		},
	},
});
