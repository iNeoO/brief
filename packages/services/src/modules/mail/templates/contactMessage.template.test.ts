import { describe, expect, it } from "vitest";
import { getContactMessageEmailTemplate } from "./contactMessage.template.js";

const baseInput = {
	fromEmail: "reader@example.test",
	subject: "A source worth adding",
	message: "You are missing a good feed on European policy.",
};

describe("getContactMessageEmailTemplate", () => {
	it("escapes markup a visitor typed into the message", () => {
		const { html } = getContactMessageEmailTemplate({
			...baseInput,
			message: `<script>fetch("https://evil.test")</script>`,
		});

		expect(html).not.toContain("<script>");
		expect(html).toContain(
			"&lt;script&gt;fetch(&quot;https://evil.test&quot;)&lt;/script&gt;",
		);
	});

	it("escapes the subject in the body and carries it into the mail subject", () => {
		const { subject, html } = getContactMessageEmailTemplate({
			...baseInput,
			subject: "<b>urgent</b>",
		});

		// The header is not HTML, so it keeps the characters the visitor typed;
		// the body is, so the same string arrives escaped there.
		expect(subject).toBe("[Daily Briefs] <b>urgent</b>");
		expect(html).toContain("&lt;b&gt;urgent&lt;/b&gt;");
		expect(html).not.toContain("<b>urgent</b>");
	});

	it("escapes an address before putting it in the mailto link", () => {
		const { html } = getContactMessageEmailTemplate({
			...baseInput,
			fromEmail: `a@b.test"><script>`,
		});

		expect(html).not.toContain("<script>");
		expect(html).toContain("&quot;&gt;&lt;script&gt;");
	});

	it("turns the message's newlines into breaks, and only those", () => {
		const { html } = getContactMessageEmailTemplate({
			...baseInput,
			// A typed `<br>` must stay text: the escape runs first, so only the
			// real newline becomes markup.
			message: "First line\r\nSecond line<br>still the second",
		});

		expect(html).toContain("First line<br />Second line");
		expect(html).toContain("&lt;br&gt;still the second");
		expect(html.match(/<br \/>/g)).toHaveLength(1);
	});
});
