import { asc, eq, schema } from "@brief/drizzle";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDatabase, recordingChain } from "../../testing/db.fake.js";
import { ProvidersService } from "./providers.service.js";

const PROVIDER_ID = "provider-1";

const rows = [
	{ id: "provider-2", name: "France 24", isEnabled: true },
	{ id: PROVIDER_ID, name: "France Info", isEnabled: false },
];

/** One query per method, so the chain doubles as the whole fake database. */
const chain = recordingChain(rows);
const service = () => new ProvidersService(asDatabase(chain));

beforeEach(() => {
	vi.clearAllMocks();
	chain.calls.length = 0;
});

describe("listAll", () => {
	it("reads every provider by name, unpaginated", async () => {
		await expect(service().listAll()).resolves.toEqual(rows);

		expect(chain.args("from")).toEqual([schema.providers]);
		expect(chain.args("orderBy")).toEqual([asc(schema.providers.name)]);
		// The picker shows the whole list: a limit would silently hide providers.
		expect(chain.args("limit")).toBeUndefined();
	});
});

describe("touchLastFetchedAt", () => {
	it("stamps the provider it just fetched", async () => {
		await expect(service().touchLastFetchedAt(PROVIDER_ID)).resolves.toBe(
			rows[0],
		);

		expect(chain.args("update")).toEqual([schema.providers]);
		expect(chain.args("set")).toEqual([{ lastFetchedAt: expect.any(Date) }]);
		expect(chain.args("where")).toEqual([eq(schema.providers.id, PROVIDER_ID)]);
	});

	it("returns nothing when no provider carries that id", async () => {
		const empty = recordingChain();

		await expect(
			new ProvidersService(asDatabase(empty)).touchLastFetchedAt("ghost"),
		).resolves.toBeUndefined();
	});
});
