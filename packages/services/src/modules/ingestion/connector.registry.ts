import { CONNECTOR_KIND } from "@brief/common/constants";
import type { ConnectorKind } from "@brief/common/types";
import type { ArticleConnector } from "./connector.port.js";
import { AtomConnector } from "./connectors/atom.connector.js";
import { RssConnector } from "./connectors/rss.connector.js";

const byKind: Record<ConnectorKind, ArticleConnector> = {
	[CONNECTOR_KIND.RSS]: new RssConnector(),
	[CONNECTOR_KIND.ATOM]: new AtomConnector(),
};

const bySlug: Record<string, ArticleConnector> = {};

export const getConnector = (provider: {
	slug: string;
	kind: ConnectorKind;
}): ArticleConnector | undefined =>
	bySlug[provider.slug] ?? byKind[provider.kind];
