import { describe, expect, it } from "vitest";
import { clampText } from "./clampText.helper.js";

describe("clampText", () => {
	it("leaves a text within the limit untouched", () => {
		expect(clampText("Un titre court", 300)).toBe("Un titre court");
	});

	it("keeps a text of exactly the limit whole", () => {
		expect(clampText("abcde", 5)).toBe("abcde");
	});

	it("cuts a longer text and marks the cut", () => {
		expect(clampText("abcdef", 5)).toBe("abcde…");
	});
});
