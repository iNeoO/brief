import { parseArgs } from "node:util";
import {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
} from "@brief/common/constants";
import type { CategoryJobState } from "@brief/common/types";
import { db, desc, eq, schema } from "@brief/drizzle";
import { createCliLogger, wrapWithLogger } from "@brief/infra/libs";
import {
	ArticlesService,
	CategoryJobsService,
	ProcessingService,
	S3Service,
} from "@brief/services";
import { createS3Config } from "../config/s3.js";

/**
 * Runs one category job through the pipeline, in process, without a broker.
 *
 * This is the manual counterpart of the worker: it exercises the real
 * selection, summary, voice and upload steps, so it spends real API credit on
 * every run. What it deliberately does not cover is the consumer around them —
 * requeueing, the retry budget and the DLQ all live in `consumer.ts`.
 *
 *   pnpm category:run --list
 *   pnpm category:run --job 12
 *   pnpm category:run --job 12 --reset
 *   pnpm category:run --job 12 --from creating_audio
 */

const STATES = Object.values(CATEGORY_JOB_STATE);

const USAGE = `Usage:
  --list              show the latest category jobs and exit
  --job <id>          the category job to run
  --reset             replay from the first step, dropping the stored report
  --from <state>      replay from a given step (${STATES.join(" | ")})

--reset and --from put the job back to pending, so an already finished or
failed job can be run again.`;

const parseCliArgs = () => {
	const { values } = parseArgs({
		options: {
			list: { type: "boolean", default: false },
			job: { type: "string" },
			reset: { type: "boolean", default: false },
			from: { type: "string" },
		},
	});

	if (values.from && !STATES.includes(values.from as CategoryJobState)) {
		throw new Error(
			`Unknown state "${values.from}". Expected one of: ${STATES.join(", ")}`,
		);
	}

	return {
		list: values.list,
		jobId: values.job ? Number(values.job) : undefined,
		reset: values.reset,
		from: values.from as CategoryJobState | undefined,
	};
};

const listJobs = async () => {
	const jobs = await db
		.select({
			id: schema.categoryJobs.id,
			category: schema.categories.name,
			targetDate: schema.categoryJobs.targetDate,
			status: schema.categoryJobs.status,
			state: schema.categoryJobs.state,
			retry: schema.categoryJobs.retry,
			error: schema.categoryJobs.error,
		})
		.from(schema.categoryJobs)
		.innerJoin(
			schema.categories,
			eq(schema.categories.id, schema.categoryJobs.categoryId),
		)
		.orderBy(desc(schema.categoryJobs.createdAt))
		.limit(10);

	if (jobs.length === 0) {
		console.log("No category job yet — the scheduler creates them.");
		return;
	}

	console.table(
		jobs.map((job) => ({
			...job,
			targetDate: job.targetDate.toISOString().slice(0, 10),
			error: job.error?.slice(0, 60) ?? "",
		})),
	);
};

/** Dev-only escape hatch: the worker never rewinds a job by hand. */
const rewind = async (
	jobId: number,
	from: CategoryJobState,
	reset: boolean,
) => {
	const [job] = await db
		.update(schema.categoryJobs)
		.set({
			status: CATEGORY_JOB_STATUS.PENDING,
			state: from,
			error: null,
			retry: 0,
			finishedAt: null,
			...(reset ? { summary: null, sources: null } : {}),
		})
		.where(eq(schema.categoryJobs.id, jobId))
		.returning();

	return job;
};

const report = async (jobId: number) => {
	const [job] = await db
		.select()
		.from(schema.categoryJobs)
		.where(eq(schema.categoryJobs.id, jobId));

	const files = await db
		.select({
			kind: schema.files.kind,
			language: schema.files.language,
			objectKey: schema.files.objectKey,
			size: schema.files.size,
		})
		.from(schema.files)
		.where(eq(schema.files.categoryJobId, jobId));

	const events = await db
		.select({
			attempt: schema.categoryJobEvents.attempt,
			state: schema.categoryJobEvents.state,
			status: schema.categoryJobEvents.status,
			error: schema.categoryJobEvents.error,
		})
		.from(schema.categoryJobEvents)
		.where(eq(schema.categoryJobEvents.categoryJobId, jobId))
		.orderBy(schema.categoryJobEvents.createdAt);

	console.log(`\nJob ${jobId}: ${job?.status} / ${job?.state}`);
	console.log(`Summary: ${job?.summary?.length ?? 0} characters`);
	if (job?.error) console.log(`Error: ${job.error}`);

	console.log("\nSteps:");
	console.table(
		events.map((event) => ({ ...event, error: event.error ?? "" })),
	);

	console.log("Files:");
	console.table(files);
};

const main = async () => {
	const args = parseCliArgs();

	if (args.list) {
		await listJobs();
		return;
	}

	if (!args.jobId || Number.isNaN(args.jobId)) {
		console.error(USAGE);
		process.exitCode = 1;
		return;
	}

	const jobId = args.jobId;

	if (args.reset || args.from) {
		const from = args.from ?? CATEGORY_JOB_STATE.CREATING_REPORT;
		const rewound = await rewind(jobId, from, args.reset);

		if (!rewound) {
			console.error(`No category job ${jobId}.`);
			process.exitCode = 1;
			return;
		}
		console.log(`Job ${jobId} rewound to "${from}".`);
	}

	const categoryJobsService = new CategoryJobsService(db);
	const processingService = new ProcessingService(
		new ArticlesService(db),
		categoryJobsService,
		db,
		new S3Service(db, createS3Config()),
	);

	const job = await categoryJobsService.claimJob(jobId);

	if (!job) {
		console.error(
			`Job ${jobId} is not pending, so it cannot be claimed. Re-run with --reset to replay it, or --from <state> to resume it.`,
		);
		process.exitCode = 1;
		return;
	}

	console.log(
		`Running job ${jobId} — category "${job.category.name}", ${job.category.providers.length} providers, from state "${job.state}".`,
	);

	// The services log through the async-local store, like the worker does —
	// but at debug, so the selection and the summary show up here.
	const logger = createCliLogger({ workerId: "category-run" });

	try {
		await wrapWithLogger(logger, async () => {
			await processingService.runCategoryJob(job);
			const [finished] = await categoryJobsService.markFinished(jobId);
			if (!finished)
				throw new Error(`Job ${jobId} could not be marked finished`);
		});
	} catch (err) {
		// Mirrors the consumer so a manual run leaves the same trace behind.
		const message = err instanceof Error ? err.message : String(err);
		await categoryJobsService.incrementRetry(jobId, message);
		logger.error({ err, jobId }, "category job failed");
		process.exitCode = 1;
	}

	await report(jobId);
};

await main();
await db.$client.end();
