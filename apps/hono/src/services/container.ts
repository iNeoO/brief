import { type Database, db } from "@brief/drizzle";
import { ArticlesService, IngestionService, ProvidersService } from "@brief/services";

export type AppServices = {
	db: Database;
	articles: ArticlesService;
	providers: ProvidersService;
	ingestion: IngestionService;
};

export const createServices = (): AppServices => {
	const articles = new ArticlesService(db);
	const providers = new ProvidersService(db);

	return {
		db,
		articles,
		providers,
		ingestion: new IngestionService(db, articles, providers),
	};
};

export const services = createServices();
