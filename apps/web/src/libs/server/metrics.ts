import type { DailyPipelineCounts } from "@brief/services";
import {
	Counter,
	collectDefaultMetrics,
	Gauge,
	Histogram,
	Registry,
} from "prom-client";

const METRIC_PREFIX = "brief_web_";

/**
 * Route label values, kept to a fixed set on purpose.
 *
 * `route` is a Prometheus label, so every distinct value is a new time series.
 * The raw pathname is unbounded — brief ids, file uuids, hashed asset names,
 * crawler noise — so anything that is not a route this app actually serves
 * collapses into `other`. Add an entry here when a route file is added; the
 * metric silently degrades to `other` if you forget, it never explodes.
 */
const KNOWN_ROUTES = new Set([
	"/",
	"/admin",
	"/admin/categories",
	"/api/briefs/audio/:id",
	"/api/telegram/webhook",
	"/briefs",
	"/briefs/:id",
	"/forgot-password",
	"/home",
	"/how-it-works",
	"/metrics",
	"/profile",
	"/reset-password",
	"/robots.txt",
	"/sign-in",
	"/sign-up",
	"/sitemap.xml",
	"/topics",
	"/validate-email",
]);

/**
 * Files served from the root of `public/`, rather than from the hashed
 * `/assets/` bundle. A browser asks for the favicon and the manifest on every
 * cold visit, and a crawler asks for the social cards, so leaving them in
 * `other` would bury the requests that bucket exists to surface — the ones
 * nothing here serves at all.
 */
const ROOT_STATIC_FILES = new Set([
	"/apple-touch-icon.png",
	"/favicon.ico",
	"/favicon.svg",
	"/icon-192.png",
	"/icon-512.png",
	"/og-en.png",
	"/og-fr.png",
	"/site.webmanifest",
]);

const UUID_SEGMENT =
	/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

/** Brief ids are serials, so `/briefs/$id` arrives as `/briefs/42`. */
const NUMERIC_SEGMENT = /\/\d+(?=\/|$)/g;

/**
 * Every server function call lands on the same generated endpoint with the
 * function id in the query string. They are counted per operation by
 * {@link observeServerFn}, so the HTTP view only needs the aggregate.
 */
const SERVER_FN_ROUTE = "/_serverFn";

export const normalizeRoute = (pathname: string) => {
	if (pathname.startsWith("/_serverFn")) {
		return SERVER_FN_ROUTE;
	}

	if (
		pathname.startsWith("/assets/") ||
		pathname.startsWith("/_build/") ||
		pathname.startsWith("/@") ||
		ROOT_STATIC_FILES.has(pathname)
	) {
		return "static";
	}

	const template = pathname
		.replace(UUID_SEGMENT, "/:id")
		.replace(NUMERIC_SEGMENT, "/:id");

	return KNOWN_ROUTES.has(template) ? template : "other";
};

export const getStatusClass = (statusCode: number) =>
	`${Math.floor(Math.max(statusCode, 0) / 100)}xx`;

const createMetrics = () => {
	const registry = new Registry();

	// Event loop lag, GC pauses, heap and handle counts. They matter here because
	// this process renders React server-side: a blocked event loop shows up as
	// slow documents long before it shows up as an error.
	collectDefaultMetrics({ register: registry, prefix: METRIC_PREFIX });

	const httpRequestDurationSeconds = new Histogram({
		name: `${METRIC_PREFIX}http_request_duration_seconds`,
		help: "HTTP request duration in seconds, measured until the response is returned.",
		registers: [registry],
		labelNames: ["route", "method", "status_class"] as const,
		buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
	});

	const serverFnRequestsTotal = new Counter({
		name: `${METRIC_PREFIX}server_fn_requests_total`,
		help: "Total number of server function invocations.",
		registers: [registry],
		labelNames: ["operation", "result", "status_class"] as const,
	});

	const serverFnDurationSeconds = new Histogram({
		name: `${METRIC_PREFIX}server_fn_duration_seconds`,
		help: "Server function handler duration in seconds.",
		registers: [registry],
		labelNames: ["operation", "status_class"] as const,
		buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
	});

	const categoryJobs = new Gauge({
		name: `${METRIC_PREFIX}category_jobs`,
		help: "Category jobs of the current target date, by status.",
		registers: [registry],
		labelNames: ["status"] as const,
	});

	const providerFetchJobs = new Gauge({
		name: `${METRIC_PREFIX}provider_fetch_jobs`,
		help: "Provider fetch jobs of the current target date, by status.",
		registers: [registry],
		labelNames: ["status"] as const,
	});

	const messageJobs = new Gauge({
		name: `${METRIC_PREFIX}message_jobs`,
		help: "Telegram deliveries of the current target date's briefs, by status.",
		registers: [registry],
		labelNames: ["status"] as const,
	});

	const categoryJobTokens = new Gauge({
		name: `${METRIC_PREFIX}category_job_tokens`,
		help: "LLM tokens billed for the current target date, summed over every attempt.",
		registers: [registry],
		labelNames: ["kind"] as const,
	});

	return {
		registry,
		httpRequestDurationSeconds,
		serverFnRequestsTotal,
		serverFnDurationSeconds,
		categoryJobs,
		providerFetchJobs,
		messageJobs,
		categoryJobTokens,
	};
};

type ServerMetrics = ReturnType<typeof createMetrics>;

/**
 * Same reasoning as the server container: `vite dev` re-evaluates this module
 * on every hot reload, and prom-client throws when a metric name is registered
 * twice. Pinning the registry to `globalThis` keeps one set of collectors per
 * process, so a reload neither crashes the server nor resets the counters.
 */
const METRICS_KEY = Symbol.for("@brief/web/metrics");

type GlobalWithMetrics = typeof globalThis & {
	[METRICS_KEY]?: ServerMetrics;
};

const globalWithMetrics = globalThis as GlobalWithMetrics;

globalWithMetrics[METRICS_KEY] ??= createMetrics();

const metrics: ServerMetrics = globalWithMetrics[METRICS_KEY];

export const renderMetrics = () => metrics.registry.metrics();

export const metricsContentType = metrics.registry.contentType;

export const observeHttpRequest = ({
	pathname,
	method,
	statusCode,
	durationMs,
}: {
	pathname: string;
	method: string;
	statusCode: number;
	durationMs: number;
}) => {
	metrics.httpRequestDurationSeconds
		.labels(normalizeRoute(pathname), method, getStatusClass(statusCode))
		.observe(durationMs / 1000);
};

export const observeServerFn = ({
	operation,
	statusCode,
	durationMs,
	result,
}: {
	operation: string;
	statusCode: number;
	durationMs: number;
	result: "success" | "error";
}) => {
	const statusClass = getStatusClass(statusCode);

	metrics.serverFnRequestsTotal.labels(operation, result, statusClass).inc();
	metrics.serverFnDurationSeconds
		.labels(operation, statusClass)
		.observe(durationMs / 1000);
};

/**
 * Called by the `/metrics` handler, once per scrape, rather than from a timer.
 * Three indexed counts are cheaper than the timer's bookkeeping, and the answer
 * is the state at scrape time instead of the state at the last tick.
 */
export const setPipelineGauges = (counts: DailyPipelineCounts) => {
	for (const [status, count] of Object.entries(counts.categoryJobs)) {
		metrics.categoryJobs.labels(status).set(count);
	}

	for (const [status, count] of Object.entries(counts.providerFetchJobs)) {
		metrics.providerFetchJobs.labels(status).set(count);
	}

	for (const [status, count] of Object.entries(counts.messageJobs)) {
		metrics.messageJobs.labels(status).set(count);
	}

	metrics.categoryJobTokens.labels("prompt").set(counts.tokens.prompt);
	metrics.categoryJobTokens.labels("completion").set(counts.tokens.completion);
	metrics.categoryJobTokens.labels("total").set(counts.tokens.total);
};
