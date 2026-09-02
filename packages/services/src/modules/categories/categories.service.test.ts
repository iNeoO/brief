import type { Database } from "@brief/drizzle";
import { beforeEach, describe, expect, it } from "vitest";
import { CategoriesService } from "./categories.service.js";

/** What the service asked the relational query for. */
let findManyArgs: { where?: Record<string, unknown> } | undefined;

const db = {
	query: {
		categories: {
			findMany: (args: { where?: Record<string, unknown> }) => {
				findManyArgs = args;
				return Promise.resolve([]);
			},
		},
	},
};

const service = () => new CategoriesService(db as unknown as Database);

beforeEach(() => {
	findManyArgs = undefined;
});

describe("getCategories", () => {
	it("keeps only the enabled categories someone follows", async () => {
		await service().getCategories({ isEnabled: true, hasSubscribers: true });

		// `subscriptions: true` is the relational EXISTS: at least one row in
		// `subscriptions` pointing at the category.
		expect(findManyArgs?.where).toEqual({
			isEnabled: true,
			subscriptions: true,
		});
	});

	it("leaves out the filters the caller did not ask for", async () => {
		// An undefined entry is dropped from the WHERE rather than matched
		// against, so an unfiltered call still returns every category.
		await service().getCategories({});

		expect(findManyArgs?.where).toEqual({
			isEnabled: undefined,
			subscriptions: undefined,
		});
	});
});
