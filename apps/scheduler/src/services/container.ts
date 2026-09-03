import { createDb } from "@brief/drizzle";
import { AmqpPublisher } from "@brief/infra/amqp";
import {
	CategoriesService,
	CategoryJobsService,
	ProviderFetchJobsService,
} from "@brief/services";
import { Data, Effect } from "effect";
import { env } from "../config/env.js";

class CategoriesDbError extends Data.TaggedError("CategoriesDbError")<{
	cause: unknown;
}> {}

class AmqpPublishError extends Data.TaggedError("AmqpPublishError")<{
	cause: unknown;
}> {}

export class DatabaseService extends Effect.Service<DatabaseService>()(
	"DatabaseService",
	{
		scoped: Effect.gen(function* () {
			const db = yield* Effect.acquireRelease(
				Effect.sync(() => createDb()),
				(db) => Effect.promise(() => db.$client.end()),
			);

			return { db };
		}),
	},
) {}

export class AmqpService extends Effect.Service<AmqpService>()("AmqpService", {
	scoped: Effect.gen(function* () {
		const publisher = yield* Effect.acquireRelease(
			Effect.promise(async () => {
				const publisher = new AmqpPublisher({
					id: "scheduler",
					url: env.AMQP_URL,
					queue: env.PROVIDER_FETCH_QUEUE,
				});
				await publisher.init();
				return publisher;
			}),
			(publisher) => Effect.promise(() => publisher.close()),
		);

		return { publisher };
	}),
}) {}

export class ContainerService extends Effect.Service<ContainerService>()(
	"ContainerService",
	{
		effect: Effect.gen(function* () {
			const { db } = yield* DatabaseService;
			const { publisher } = yield* AmqpService;

			const categoriesService = new CategoriesService(db);
			const categoryJobService = new CategoryJobsService(db);
			const providerFetchJobs = new ProviderFetchJobsService(db);

			const getCategories = (args: { isEnable?: boolean }) =>
				Effect.tryPromise({
					try: () => categoriesService.getCategories(args),
					catch: (cause) => new CategoriesDbError({ cause }),
				});

			const createCategoryJob = (args: {
				categoryId: string;
				targetDate: Date;
			}) =>
				Effect.tryPromise({
					try: () => categoryJobService.createJob(args),
					catch: (cause) => new CategoriesDbError({ cause }),
				});

			const createProviderFetchJobs = (args: {
				providerId: string;
				targetDate: Date;
			}) =>
				Effect.tryPromise({
					try: () => providerFetchJobs.createJob(args),
					catch: (cause) => new CategoriesDbError({ cause }),
				});

			const publishProviderFetchJob = (id: number) =>
				Effect.tryPromise({
					try: () => publisher.publish({ id }),
					catch: (cause) => new AmqpPublishError({ cause }),
				});

			return {
				getCategories,
				createCategoryJob,
				createProviderFetchJobs,
				publishProviderFetchJob,
			};
		}),
		dependencies: [DatabaseService.Default, AmqpService.Default],
	},
) {}
