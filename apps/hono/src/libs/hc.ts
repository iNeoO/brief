import { hc } from "hono/client";
import type { createApp } from "../app.js";

type App = ReturnType<typeof createApp>;

const client = hc<App>("", {
	init: { credentials: "include" },
});
export type Client = typeof client;

export const hcWithType = (...args: Parameters<typeof hc>): Client =>
	hc<App>(...args);
