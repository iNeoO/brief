import { type Database, eq, schema } from "@brief/drizzle";
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

	async ingestProvider(provider: Provider) {
		const connector = getConnector(provider.slug);

		if (!connector) {
			const logger = getLoggerStore();
			logger.error({ provider }, "No connector for provider");
			throw new InternalError({
				message: `No connector for provider "${provider.slug}"`,
				code: "NO_CONNECTOR",
			});
		}

		const limit = provider.fetchLimit ?? DEFAULT_FETCH_LIMIT;
		const raw = await connector.fetchLatest({ url: provider.url, limit });

		const rows = raw.map((a) => ({
			providerId: provider.id,
			url: canonicalizeUrl(a.url, provider.url),
			title: a.title,
			content: a.content,
			description: a.description ?? null,
			publishedAt: a.publishedAt ?? null,
		}));

		const inserted = await this.articlesService.createManyArticles(rows);

		await this.providersService.touchLastFetchedAt(provider.id);

		return inserted.length;
	}

	async ingestBySlug(slug: string) {
		const provider = await this.db
			.select()
			.from(schema.providers)
			.where(eq(schema.providers.slug, slug))
			.then((res) => res[0]);

		if (!provider) {
			const logger = getLoggerStore();
			logger.error({ slug }, "No provider for slug");
			throw new InternalError({
				message: `No connector for provider "${slug}"`,
				code: "NO_CONNECTOR",
			});
		}

		await this.ingestProvider(provider);
	}
}
