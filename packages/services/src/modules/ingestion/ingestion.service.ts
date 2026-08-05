import { type Database, schema } from "@brief/drizzle";
import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";
import type { ArticlesService } from "../articles/articles.service.js";
import type { ProvidersService } from "../providers/providers.service.js";
import { getConnector } from "./connector.registry.js";
import type { Provider } from "./ingestion.type.js";
import { canonicalizeUrl } from "./url.helper.js";

const DEFAULT_FETCH_LIMIT = 5;

export class IngestionService {
	constructor(
		private db: Database,
		private articlesService: ArticlesService,
		private providersService: ProvidersService,
	) {}

	async ingestProvider(providerFetchJobId: number, provider: Provider) {
		const connector = getConnector(provider);

		if (!connector) {
			const logger = getLoggerStore();
			logger.error({ provider }, "No connector for provider");
			throw new InternalError({
				message: `No connector for kind "${provider.kind}" (provider "${provider.slug}")`,
				code: "NO_CONNECTOR",
			});
		}

		const limit = provider.fetchLimit ?? DEFAULT_FETCH_LIMIT;
		const raw = await connector.fetchLatest({
			url: provider.url,
			limit,
			label: provider.name,
		});

		const rows = raw.map((a) => ({
			providerId: provider.id,
			url: canonicalizeUrl(a.url, provider.url),
			title: a.title,
			content: a.content,
			description: a.description ?? null,
			publishedAt: a.publishedAt ?? null,
		}));

		await this.articlesService.createManyArticles(rows);

		// `createManyArticles` only returns the newly inserted rows
		// (`onConflictDoNothing`); resolve the full set actually observed by
		// this fetch — new and already-known alike — to snapshot in
		// `provider_fetch_job_articles`.
		const observed = await this.articlesService.findByProviderAndUrls(
			provider.id,
			rows.map((row) => row.url),
		);

		if (observed.length > 0) {
			await this.db
				.insert(schema.providerFetchJobArticles)
				.values(
					observed.map((article) => ({
						providerFetchJobId,
						articleId: article.id,
					})),
				)
				.onConflictDoNothing({
					target: [
						schema.providerFetchJobArticles.providerFetchJobId,
						schema.providerFetchJobArticles.articleId,
					],
				});
		}

		await this.providersService.touchLastFetchedAt(provider.id);

		return observed.length;
	}
}
