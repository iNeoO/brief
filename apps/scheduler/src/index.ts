import { createSchedulerLogger, getLoggerStore } from "@brief/infra/libs";
import { NodeRuntime } from "@effect/platform-node";
import { Cron, DateTime, Effect, Schedule } from "effect";
import { withLogger } from "./lib/withLogger.js";
import { ContainerService } from "./services/container.js";

const cron = Cron.make({
	seconds: [0],
	minutes: [0],
	hours: [7],
	days: [],
	months: [],
	// Monday to Friday: no brief on the weekend. Effect matches on `getUTCDay`,
	// so 0 is Sunday and 6 is Saturday.
	weekdays: [1, 2, 3, 4, 5],
	tz: DateTime.zoneUnsafeMakeNamed("Europe/Paris"),
});

const schedule = Schedule.cron(cron);

const job = Effect.gen(function* () {
	const container = yield* ContainerService;
	const today = new Date();

	const categories = yield* container.getCategories({ isEnable: true });
	const providerIds = [
		...new Set(
			categories.flatMap(({ providers }) => providers.map(({ id }) => id)),
		),
	];

	const logger = getLoggerStore();
	if (!providerIds.length) {
		logger.info("No categories to create");
		return;
	}

	const { newProviderFetchJobs } = yield* container.planDailyRun({
		categories,
		targetDate: today,
	});

	for (const fetchJob of newProviderFetchJobs) {
		yield* container.publishProviderFetchJob(fetchJob.id);
	}

	logger.info(`running job at 7am Paris — ${categories.length} categories`);
});

const handler = Effect.gen(function* () {
	const date = new Date();
	const logger = createSchedulerLogger({
		schedulerId: "1",
		date: date.toISOString(),
	});

	yield* job.pipe(withLogger(logger));
});

// `--now` plans one run immediately and exits, instead of waiting for the next
// 7am. The daily jobs are idempotent per date, so replaying it is harmless.
const runNow = process.argv.includes("--now");

const program = Effect.provide(
	runNow ? handler : Effect.schedule(handler, schedule),
	ContainerService.Default,
);

NodeRuntime.runMain(program);
