import {
	CATEGORY_JOB_STATE,
	CATEGORY_JOB_STATUS,
	JOB_STATUS,
} from "@brief/common/constants";
import { and, type Database, eq, schema } from "@brief/drizzle";
import { beforeEach, describe, expect, it } from "vitest";
import { CategoryJobsService } from "./categoryJobs.service.js";

const JOB_ID = 42;

/**
 * A stand-in for the update builder that keeps what the service asked for. The
 * `where` clause is compared against one built from the same helpers, so the
 * guard the update claims to hold is checked rather than assumed.
 */
let update: { set?: Record<string, unknown>; where?: unknown };

/** What the update hands back; empty stands for a row the guard refused. */
let returning: { id: number }[];

const db = {
	update: (table: unknown) => {
		expect(table).toBe(schema.categoryJobs);
		return {
			set: (values: Record<string, unknown>) => {
				update.set = values;
				return {
					where: (condition: unknown) => {
						update.where = condition;
						return { returning: () => Promise.resolve(returning) };
					},
				};
			},
		};
	},
};

const service = () => new CategoryJobsService(db as unknown as Database);

beforeEach(() => {
	update = {};
	returning = [{ id: JOB_ID }];
});

describe("markNoArticlesSelected", () => {
	it("settles the job without recording a failure", async () => {
		await expect(service().markNoArticlesSelected(JOB_ID)).resolves.toEqual([
			{ id: JOB_ID },
		]);

		expect(update.set).toEqual({
			status: CATEGORY_JOB_STATUS.NO_ARTICLES_SELECTED,
			// No error text: a quiet day must not read as an incident, and the
			// `finished_at` is what the terminal-status check constraint wants.
			error: null,
			finishedAt: expect.any(Date),
		});
	});

	it("leaves the retry counter and the token totals alone", async () => {
		await service().markNoArticlesSelected(JOB_ID);

		// The selection call was billed even though it kept nothing, and the
		// retries this job did spend stay on the record.
		expect(update.set).not.toHaveProperty("retry");
		expect(update.set).not.toHaveProperty("promptTokens");
		expect(update.set).not.toHaveProperty("completionTokens");
		expect(update.set).not.toHaveProperty("totalTokens");
	});

	// Only the worker that still holds the job may settle it: a second one that
	// has already moved it on gets nothing back and knows to leave it be.
	it("only claims a running job still in the report state", async () => {
		await service().markNoArticlesSelected(JOB_ID);

		expect(update.where).toEqual(
			and(
				eq(schema.categoryJobs.id, JOB_ID),
				eq(schema.categoryJobs.status, JOB_STATUS.RUNNING),
				eq(schema.categoryJobs.state, CATEGORY_JOB_STATE.CREATING_REPORT),
			),
		);
	});

	it("returns nothing when the guard matches no row", async () => {
		returning = [];

		await expect(service().markNoArticlesSelected(JOB_ID)).resolves.toEqual([]);
	});
});
