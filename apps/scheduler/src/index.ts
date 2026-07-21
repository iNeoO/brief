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
	weekdays: [0, 1, 2, 3, 4, 5],
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

	for (const category of categories) {
		yield* container.createCategoryJob({
			targetDate: today,
			categoryId: category.id,
		});
	}

	for (const providerId of providerIds) {
		const [job] = yield* container.createProviderFetchJobs({
			targetDate: today,
			providerId,
		});

		if (job) {
			yield* container.publishProviderFetchJob(job.id);
		}
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

const program = Effect.schedule(handler, schedule).pipe(
	Effect.provide(ContainerService.Default),
);

NodeRuntime.runMain(program);
