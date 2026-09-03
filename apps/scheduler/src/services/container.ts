import { createDb } from "@brief/drizzle";
import { CategoriesService, CategoryJobsService } from "@brief/services";
import { Data, Effect } from "effect";

class CategoriesDbError extends Data.TaggedError("CategoriesDbError")<{
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

export class ContainerService extends Effect.Service<ContainerService>()(
	"ContainerService",
	{
		effect: Effect.gen(function* () {
			const { db } = yield* DatabaseService;

			const categoriesService = new CategoriesService(db);
			const categoryJobService = new CategoryJobsService(db);

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

			return {
				getCategories,
				createCategoryJob,
			};
		}),
		dependencies: [DatabaseService.Default],
	},
) {}
