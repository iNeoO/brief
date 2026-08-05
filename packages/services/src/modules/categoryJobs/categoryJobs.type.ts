import type { schema } from "@brief/drizzle";

type CategoryJob = typeof schema.categoryJobs.$inferSelect;
type Category = typeof schema.categories.$inferSelect;
type Provider = typeof schema.providers.$inferSelect;

export type ClaimedCategoryJob = CategoryJob & {
	category: Category & {
		providers: Provider[];
	};
};
