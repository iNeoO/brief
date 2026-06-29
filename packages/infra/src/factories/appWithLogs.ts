import { createFactory } from "hono/factory";
import type { RequestIdVariables } from "hono/request-id";
import type { Logger } from "pino";

export type LogsBindings = {
	Variables: {
		logger: Logger;
	} & RequestIdVariables;
};

export const appWithLogs = createFactory<LogsBindings>();
