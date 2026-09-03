import { describe, expect, it } from "vitest";
import { getVerificationEmailTemplate } from "./verificationEmail.template.js";

const baseInput = {
	name: "Valere",
	url: "https://dailybriefs.fr/verify-email?token=abc123",
};

describe("getVerificationEmailTemplate", () => {
	it("greets the reader and points the button at the verification link", () => {
		const { subject, html } = getVerificationEmailTemplate(baseInput);

		expect(subject).toBe("Confirm your email address");
		expect(html).toContain("Hi Valere,");
		expect(html).toContain("Confirm my address");
		expect(html).toContain(baseInput.url);
	});

	it("escapes markup a name carries into the greeting", () => {
		const { html } = getVerificationEmailTemplate({
			...baseInput,
			name: "<img src=x onerror=alert(1)>",
		});

		expect(html).not.toContain("<img src=x");
		expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
	});

	it("escapes a url before putting it in the href", () => {
		const { html } = getVerificationEmailTemplate({
			...baseInput,
			url: `https://dailybriefs.fr/"><script>`,
		});

		expect(html).not.toContain("<script>");
		expect(html).toContain("&quot;&gt;&lt;script&gt;");
	});

	it("still renders when the account has no name", () => {
		const { html } = getVerificationEmailTemplate({ ...baseInput, name: "" });

		expect(html).toContain("Hi ,");
	});
});
