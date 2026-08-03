import type { CONNECTOR_KIND } from "../constants/connectors.constant.js";

export type ConnectorKind =
	(typeof CONNECTOR_KIND)[keyof typeof CONNECTOR_KIND];
