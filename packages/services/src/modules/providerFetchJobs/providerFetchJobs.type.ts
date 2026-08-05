import type { schema } from "@brief/drizzle";

type ProviderFetchJob = typeof schema.providerFetchJobs.$inferSelect;
type Provider = typeof schema.providers.$inferSelect;

export type ClaimedProviderFetchJob = ProviderFetchJob & {
	provider: Provider;
};
