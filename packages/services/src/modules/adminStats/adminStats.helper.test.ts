import { COST_CURRENCY } from "@brief/common/constants";
import { describe, expect, it } from "vitest";
import {
	estimateCost,
	fillDays,
	statsWindow,
	toDayKey,
} from "./adminStats.helper.js";

describe("statsWindow", () => {
	it("covers the last days up to today, in UTC, oldest first", () => {
		// 23:30 in Paris is already the next day in UTC: the window follows UTC.
		const now = new Date("2026-09-23T23:30:00.000+02:00");

		const { since, dayKeys } = statsWindow(now, 3);

		expect(since).toEqual(new Date("2026-09-21T00:00:00.000Z"));
		expect(dayKeys).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
	});

	it("crosses a month boundary day by day", () => {
		const { dayKeys } = statsWindow(new Date("2026-03-01T12:00:00.000Z"), 3);

		expect(dayKeys).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
	});

	it("is a single day for a window of one", () => {
		const { since, dayKeys } = statsWindow(
			new Date("2026-09-23T12:00:00.000Z"),
			1,
		);

		expect(toDayKey(since)).toBe("2026-09-23");
		expect(dayKeys).toEqual(["2026-09-23"]);
	});
});

describe("fillDays", () => {
	const empty = (day: string) => ({ day, count: 0 });

	it("keeps the window's order and zeroes the days nothing ran on", () => {
		const filled = fillDays(
			["2026-09-21", "2026-09-22", "2026-09-23"],
			[{ day: "2026-09-23", count: 4 }],
			empty,
		);

		expect(filled).toEqual([
			{ day: "2026-09-21", count: 0 },
			{ day: "2026-09-22", count: 0 },
			{ day: "2026-09-23", count: 4 },
		]);
	});

	it("drops a row outside the window", () => {
		// A job dated tomorrow must not add a 31st point to a 30-day chart.
		const filled = fillDays(
			["2026-09-23"],
			[{ day: "2026-09-24", count: 1 }],
			empty,
		);

		expect(filled).toEqual([{ day: "2026-09-23", count: 0 }]);
	});
});

describe("estimateCost", () => {
	const usage = {
		promptTokens: 2_000_000,
		completionTokens: 500_000,
		ttsCharacters: 3_000_000,
	};

	it("prices each half per million units and totals them", () => {
		expect(
			estimateCost(usage, {
				llm: { promptPerMillionTokens: 1, completionPerMillionTokens: 4 },
				tts: { perMillionCharacters: 10 },
			}),
		).toEqual({ llm: 4, tts: 30, total: 34, currency: COST_CURRENCY });
	});

	it("leaves a half null when its prices are missing, and the total with it", () => {
		expect(
			estimateCost(usage, {
				llm: { promptPerMillionTokens: 1, completionPerMillionTokens: 4 },
			}),
		).toMatchObject({ llm: 4, tts: null, total: null });

		expect(
			estimateCost(usage, { tts: { perMillionCharacters: 10 } }),
		).toMatchObject({ llm: null, tts: 30, total: null });

		expect(estimateCost(usage, {})).toMatchObject({
			llm: null,
			tts: null,
			total: null,
		});
	});
});
