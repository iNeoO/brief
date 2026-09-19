import { LOCALE, MESSAGE_RETRY_DELAYS_MS } from "@brief/common/constants";
import type { Locale } from "@brief/common/types";
import { describe, expect, it } from "vitest";
import {
	buildAudioTitle,
	buildAudioUrl,
	buildCaption,
	formatBriefDate,
	retryDelayMs,
} from "./messageJobs.helper.js";

/** A brief's target date: a calendar day, stored at UTC midnight. */
const TARGET_DATE = new Date("2026-08-28T00:00:00.000Z");

describe("formatBriefDate", () => {
	it("reads the calendar day in UTC", () => {
		expect(formatBriefDate(TARGET_DATE, LOCALE.FR)).toBe("28 août 2026");
		expect(formatBriefDate(TARGET_DATE, LOCALE.EN)).toBe("August 28, 2026");
	});

	// The trap the site's own formatter documents: any zone west of Greenwich
	// turns a UTC-midnight date into the day before.
	it("does not slip to the previous day", () => {
		const previousProcessZone = process.env.TZ;
		process.env.TZ = "America/Los_Angeles";

		expect(formatBriefDate(TARGET_DATE, LOCALE.EN)).toContain("28");

		process.env.TZ = previousProcessZone;
	});
});

describe("buildCaption", () => {
	const caption = (isFirst: boolean, locale: Locale = LOCALE.FR) =>
		buildCaption({
			locale,
			categoryName: "Actu France",
			targetDate: TARGET_DATE,
			isFirst,
		});

	it("opens the reader's day on the first delivery only", () => {
		expect(caption(true)).toBe(
			"Voici vos sujets pour la journée du 28 août 2026.\n\nVoici l'audio pour le topic Actu France.",
		);
		expect(caption(false)).toBe("Voici l'audio pour le topic Actu France.");
	});

	it("speaks the reader's locale, whatever the topic's language is", () => {
		expect(caption(false, LOCALE.EN)).toBe(
			"Here is the audio for the topic Actu France.",
		);
	});
});

describe("buildAudioTitle", () => {
	it("names the topic and the day, since Telegram would show a file name", () => {
		expect(
			buildAudioTitle({
				categoryName: "Tech",
				targetDate: TARGET_DATE,
				locale: LOCALE.EN,
			}),
		).toBe("Tech — August 28, 2026");
	});
});

describe("buildAudioUrl", () => {
	it("points at the public brief endpoint Telegram fetches from", () => {
		expect(buildAudioUrl("https://dailybriefs.fr", "file-1")).toBe(
			"https://dailybriefs.fr/api/briefs/audio/file-1",
		);
	});
});

describe("retryDelayMs", () => {
	it("obeys Telegram over its own schedule", () => {
		// Retrying a 429 sooner than asked only lengthens the ban.
		expect(retryDelayMs(1, 42_000)).toBe(42_000);
		expect(retryDelayMs(3, 42_000)).toBe(42_000);
	});

	it("backs off further with each failed attempt", () => {
		expect(retryDelayMs(1)).toBe(MESSAGE_RETRY_DELAYS_MS[0]);
		expect(retryDelayMs(2)).toBe(MESSAGE_RETRY_DELAYS_MS[1]);
		expect(retryDelayMs(3)).toBe(MESSAGE_RETRY_DELAYS_MS[2]);
	});

	it("holds at the longest delay rather than falling back to none", () => {
		const longest = MESSAGE_RETRY_DELAYS_MS[MESSAGE_RETRY_DELAYS_MS.length - 1];

		expect(retryDelayMs(99)).toBe(longest);
	});
});
