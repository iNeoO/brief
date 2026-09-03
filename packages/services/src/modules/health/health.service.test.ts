import { type PinoLogger, wrapWithLogger } from "@brief/infra/libs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDatabase } from "../../testing/db.fake.js";
import { HealthService } from "./health.service.js";

const execute = vi.fn();
const error = vi.fn();

const service = () => new HealthService(asDatabase({ execute }));

/** The probe logs through the async-local store, so the test provides one. */
const probe = <T>(run: () => Promise<T>) =>
	wrapWithLogger({ error } as unknown as PinoLogger, run);

beforeEach(() => {
	vi.clearAllMocks();
	execute.mockResolvedValue(undefined);
});

describe("getDbHealth", () => {
	it("answers OK once the database has run the probe", async () => {
		await expect(probe(() => service().getDbHealth())).resolves.toBe("OK");
		expect(execute).toHaveBeenCalledOnce();
		expect(error).not.toHaveBeenCalled();
	});

	it("answers NOT OK and logs when the probe fails", async () => {
		// The endpoint is what a load balancer polls: it has to answer, so a
		// dead pool must become a verdict rather than a rejection.
		const err = new Error("connection refused");
		execute.mockRejectedValue(err);

		await expect(probe(() => service().getDbHealth())).resolves.toBe("NOT OK");
		expect(error).toHaveBeenCalledWith({ err });
	});
});

describe("getHealth", () => {
	it("reports the database verdict under `db`", async () => {
		await expect(probe(() => service().getHealth())).resolves.toEqual({
			db: "OK",
		});
	});

	it("reports the failure without throwing", async () => {
		execute.mockRejectedValue(new Error("timeout"));

		await expect(probe(() => service().getHealth())).resolves.toEqual({
			db: "NOT OK",
		});
	});
});
