import { CONNECTOR_KIND } from "@brief/common/constants";
import type { ConnectorKind } from "@brief/common/types";
import { describe, expect, it } from "vitest";
import { getConnector } from "./connector.registry.js";
import { RssConnector } from "./connectors/rss.connector.js";

describe("getConnector", () => {
	it("serves the connector of the provider kind when the slug has none of its own", () => {
		expect(
			getConnector({ slug: "le-monde", kind: CONNECTOR_KIND.RSS }),
		).toBeInstanceOf(RssConnector);
	});

	it("has nothing for a kind no connector covers", () => {
		// The ingestion service turns this into a NO_CONNECTOR error rather than
		// fetching a provider it has no way to read.
		expect(
			getConnector({
				slug: "le-monde",
				kind: "carrier-pigeon" as ConnectorKind,
			}),
		).toBeUndefined();
	});
});
