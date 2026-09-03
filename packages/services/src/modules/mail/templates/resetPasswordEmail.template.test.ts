import { describe, expect, it } from "vitest";
import { getResetPasswordEmailTemplate } from "./resetPasswordEmail.template.js";

const baseInput = {
	name: "Valere",
	url: "https://dailybriefs.fr/reset-password?token=abc123",
};

describe("getResetPasswordEmailTemplate", () => {
	it("greets the reader and points the button at the reset link", () => {
		const { subject, html } = getResetPasswordEmailTemplate(baseInput);

		expect(subject).toBe("Reset your password");
		expect(html).toContain("Hi Valere,");
		expect(html).toContain("Choose a new password");
		expect(html).toContain(baseInput.url);
	});

	it("escapes markup a name carries into the greeting", () => {
		// The name comes from the account, so it is user input like any other:
		// the shell has to escape it before it reaches the greeting.
		const { html } = getResetPasswordEmailTemplate({
			...baseInput,
			name: "<script>alert(1)</script>",
		});

		expect(html).not.toContain("<script>");
		expect(html).toContain("Hi &lt;script&gt;alert(1)&lt;/script&gt;,");
	});

	it("escapes a url before putting it in the href", () => {
		const { html } = getResetPasswordEmailTemplate({
			...baseInput,
			url: `https://dailybriefs.fr/"><script>`,
		});

		expect(html).not.toContain("<script>");
		expect(html).toContain("&quot;&gt;&lt;script&gt;");
	});

	it("still renders when the account has no name", () => {
		const { html } = getResetPasswordEmailTemplate({ ...baseInput, name: "" });

		expect(html).toContain("Hi ,");
	});
});
