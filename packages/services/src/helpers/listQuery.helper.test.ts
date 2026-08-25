import { PAGINATION, SORT_ORDER } from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import {
	escapeLikePattern,
	normalizePage,
	normalizeSort,
	toPage,
	toSearchPattern,
} from "./listQuery.helper.js";

describe("normalizePage", () => {
	it("falls back to the defaults when nothing is provided", () => {
		expect(normalizePage({})).toEqual({
			page: PAGINATION.DEFAULT_PAGE,
			pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
			offset: 0,
		});
	});

	it("keeps the page on the first one when it is out of range", () => {
		expect(normalizePage({ page: 0 }).page).toBe(PAGINATION.DEFAULT_PAGE);
		expect(normalizePage({ page: -3 }).page).toBe(PAGINATION.DEFAULT_PAGE);
	});

	it("falls back on a page that is not a finite number", () => {
		expect(normalizePage({ page: Number.NaN }).page).toBe(
			PAGINATION.DEFAULT_PAGE,
		);
	});

	it("truncates a fractional page instead of offsetting by a fraction", () => {
		expect(normalizePage({ page: 2.9 })).toMatchObject({
			page: 2,
			offset: PAGINATION.DEFAULT_PAGE_SIZE,
		});
	});

	it("clamps the page size to the ceiling", () => {
		expect(normalizePage({ pageSize: 5_000 }).pageSize).toBe(
			PAGINATION.MAX_PAGE_SIZE,
		);
	});

	it("refuses a page size below one", () => {
		expect(normalizePage({ pageSize: 0 }).pageSize).toBe(1);
	});

	it("takes the page size of the list when the caller picks none", () => {
		expect(normalizePage({ page: 3 }, { defaultPageSize: 10 })).toEqual({
			page: 3,
			pageSize: 10,
			offset: 20,
		});
	});
});

describe("normalizeSort", () => {
	const options = {
		values: ["name", "createdAt"] as const,
		defaultSort: "createdAt",
		defaultOrder: SORT_ORDER.DESC,
	};

	it("falls back on an unknown sort key", () => {
		expect(
			normalizeSort({ sort: "createdAt; drop table" as never }, options),
		).toEqual({ sort: "createdAt", order: SORT_ORDER.DESC });
	});

	it("falls back on an unknown order", () => {
		expect(normalizeSort({ order: "sideways" as never }, options).order).toBe(
			SORT_ORDER.DESC,
		);
	});

	it("keeps a known sort key and order", () => {
		expect(
			normalizeSort({ sort: "name", order: SORT_ORDER.ASC }, options),
		).toEqual({ sort: "name", order: SORT_ORDER.ASC });
	});
});

describe("escapeLikePattern", () => {
	it("escapes the ILIKE wildcards so they match literally", () => {
		expect(escapeLikePattern("100%_off")).toBe("100\\%\\_off");
	});

	it("escapes the escape character itself", () => {
		expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
	});

	it("leaves ordinary text untouched", () => {
		expect(escapeLikePattern("Écologie & climat")).toBe("Écologie & climat");
	});
});

describe("toSearchPattern", () => {
	it("wraps the trimmed term in wildcards, escaped", () => {
		expect(toSearchPattern("  50% tech  ", 60)).toBe("%50\\% tech%");
	});

	it("treats a blank search as no search at all", () => {
		expect(toSearchPattern("   ", 60)).toBe(undefined);
		expect(toSearchPattern(undefined, 60)).toBe(undefined);
	});

	it("caps the term before building the pattern", () => {
		expect(toSearchPattern("a".repeat(70), 60)).toBe(`%${"a".repeat(60)}%`);
	});
});

describe("toPage", () => {
	it("reports how many pages the total spreads over", () => {
		expect(toPage(["a"], 21, { page: 3, pageSize: 10, offset: 20 })).toEqual({
			items: ["a"],
			total: 21,
			page: 3,
			pageSize: 10,
			pageCount: 3,
		});
	});

	it("keeps an empty list on one page rather than none", () => {
		expect(toPage([], 0, { page: 1, pageSize: 10, offset: 0 }).pageCount).toBe(
			1,
		);
	});
});
