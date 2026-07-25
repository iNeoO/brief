import type { schema } from "@brief/drizzle";

export type CreateProviderFetchJobParams = {
	providerId: string;
	targetDate: Date;
};

type ProviderFetchJob = typeof schema.providerFetchJobs.$inferSelect;
type Provider = typeof schema.providers.$inferSelect;

export type ClaimedProviderFetchJob = ProviderFetchJob & {
	provider: Provider;
};
