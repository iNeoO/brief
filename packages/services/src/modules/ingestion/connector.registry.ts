import type { ArticleConnector } from "./connector.port.js";
import { FranceInfoConnector } from "./connectors/franceInfo.connector.js";

const connectors: ArticleConnector[] = [new FranceInfoConnector()];

const bySlug = new Map(connectors.map((c) => [c.slug, c]));

export const getConnector = (slug: string): ArticleConnector | undefined =>
	bySlug.get(slug);
