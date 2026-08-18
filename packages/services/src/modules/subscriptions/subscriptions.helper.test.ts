import {
	CATEGORY_SEARCH_MAX_LENGTH,
	PAGINATION,
	TOPICS_PAGE_SIZE,
} from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import { normalizeListTopicsInput } from "./subscriptions.helper.js";

describe("normalizeListTopicsInput", () => {
	it("falls back to the first page and no search when nothing is provided", () => {
		expect(normalizeListTopicsInput({})).toEqual({
			page: PAGINATION.DEFAULT_PAGE,
			pageSize: TOPICS_PAGE_SIZE,
			searchPattern: undefined,
		});
	});

	it("clamps a page below the first one", () => {
		expect(normalizeListTopicsInput({ page: 0 }).page).toBe(
			PAGINATION.DEFAULT_PAGE,
		);
		expect(normalizeListTopicsInput({ page: -3 }).page).toBe(
			PAGINATION.DEFAULT_PAGE,
		);
	});

	it("truncates a fractional page rather than rejecting it", () => {
		expect(normalizeListTopicsInput({ page: 2.9 }).page).toBe(2);
	});

	it("falls back on a page that is not a finite number", () => {
		expect(normalizeListTopicsInput({ page: Number.NaN }).page).toBe(
			PAGINATION.DEFAULT_PAGE,
		);
	});

	it("wraps the search term in an ILIKE pattern", () => {
		expect(
			normalizeListTopicsInput({ search: "  climat " }).searchPattern,
		).toBe("%climat%");
	});

	it("escapes the ILIKE wildcards of the search term", () => {
		expect(normalizeListTopicsInput({ search: "100%" }).searchPattern).toBe(
			"%100\\%%",
		);
	});

	it("treats a blank search as no search", () => {
		expect(normalizeListTopicsInput({ search: "   " }).searchPattern).toBe(
			undefined,
		);
	});

	it("caps the search length before building the pattern", () => {
		const pattern = normalizeListTopicsInput({
			search: "a".repeat(CATEGORY_SEARCH_MAX_LENGTH + 50),
		}).searchPattern;

		expect(pattern).toBe(`%${"a".repeat(CATEGORY_SEARCH_MAX_LENGTH)}%`);
	});
});
