import { describe, expect, it } from "vitest";
import { getEmailShellTemplate } from "./emailShell.template.js";

const baseInput = {
	title: "Confirm your email address",
	greeting: "Hi Alice,",
	intro: "One last step.",
	buttonLabel: "Confirm my address",
	buttonUrl: "https://brief.test/validate-email?token=abc",
	notice: "If you didn't sign up, just ignore this email.",
};

describe("getEmailShellTemplate", () => {
	it("escapes markup injected through the greeting", () => {
		const html = getEmailShellTemplate({
			...baseInput,
			greeting: `Hi <a href="https://evil.test">click here</a>,`,
		});

		expect(html.match(/<a\s/g)).toHaveLength(1);
		expect(html).toContain(
			"Hi &lt;a href=&quot;https://evil.test&quot;&gt;click here&lt;/a&gt;,",
		);
	});

	it("escapes every interpolated field", () => {
		const html = getEmailShellTemplate({
			title: "<b>title</b>",
			greeting: "<b>greeting</b>",
			intro: "<b>intro</b>",
			buttonLabel: "<b>label</b>",
			buttonUrl: "<b>url</b>",
			notice: "<b>notice</b>",
		});

		expect(html).not.toContain("<b>");
	});

	it("keeps a legitimate link usable", () => {
		const html = getEmailShellTemplate(baseInput);

		expect(html).toContain(`href="${baseInput.buttonUrl}"`);
	});
});
