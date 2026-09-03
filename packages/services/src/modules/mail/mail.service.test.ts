import { type PinoLogger, wrapWithLogger } from "@brief/infra/libs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MailService } from "./mail.service.js";

const OPERATOR_INBOX = "contact@dailybriefs.fr";
const READER = "reader@example.test";
const SINK = "delivered@resend.dev";

const send = vi.fn();
const keys: unknown[] = [];

vi.mock("resend", () => ({
	Resend: class {
		emails = { send: (...args: unknown[]) => send(...args) };
		constructor(apiKey: unknown) {
			keys.push(apiKey);
		}
	},
}));

const config = {
	apiKey: "re_test",
	from: "Daily Briefs <no-reply@dailybriefs.fr>",
	nodeEnv: "development",
};

const logger = { info: vi.fn(), error: vi.fn() };

const service = (nodeEnv = config.nodeEnv) =>
	new MailService({ ...config, nodeEnv });

const mail = <T>(cb: () => Promise<T>) =>
	wrapWithLogger(logger as unknown as PinoLogger, cb);

/** The only mail the service handed to Resend. */
const sent = () => send.mock.calls[0]?.[0];

beforeEach(() => {
	vi.clearAllMocks();
	keys.length = 0;
	send.mockResolvedValue({ data: { id: "mail-1" }, error: null });
});

describe("sendVerificationEmail", () => {
	it("sends the confirmation mail from our own domain", async () => {
		await mail(() =>
			service("production").sendVerificationEmail({
				to: READER,
				name: "Valere",
				url: "https://dailybriefs.fr/verify?token=abc",
			}),
		);

		expect(sent()).toMatchObject({
			from: config.from,
			to: READER,
			subject: "Confirm your email address",
		});
		expect(sent().html).toContain("Confirm my address");
		expect(logger.info).toHaveBeenCalledOnce();
	});

	it("opens the client with the configured key", async () => {
		await mail(() =>
			service().sendVerificationEmail({
				to: READER,
				name: "Valere",
				url: "https://dailybriefs.fr/verify?token=abc",
			}),
		);

		expect(keys).toEqual([config.apiKey]);
	});
});

describe("sendResetPasswordEmail", () => {
	it("sends the reset mail", async () => {
		await mail(() =>
			service("production").sendResetPasswordEmail({
				to: READER,
				name: "Valere",
				url: "https://dailybriefs.fr/reset?token=abc",
			}),
		);

		expect(sent()).toMatchObject({
			to: READER,
			subject: "Reset your password",
		});
	});
});

describe("sendContactMessage", () => {
	it("answers the visitor without sending as them", async () => {
		// Sending as a domain we do not sign for is what gets a mail filed as
		// spam, when it arrives at all: the address is the reply-to.
		await mail(() =>
			service("production").sendContactMessage({
				to: OPERATOR_INBOX,
				fromEmail: READER,
				subject: "A source worth adding",
				message: "You are missing a good feed.",
			}),
		);

		expect(sent()).toMatchObject({
			from: config.from,
			to: OPERATOR_INBOX,
			replyTo: READER,
		});
	});

	it("is the only mail that carries a reply-to", async () => {
		await mail(() =>
			service("production").sendVerificationEmail({
				to: READER,
				name: "Valere",
				url: "https://dailybriefs.fr/verify?token=abc",
			}),
		);

		expect(sent()).not.toHaveProperty("replyTo");
	});
});

describe("the recipient outside production", () => {
	it("redirects every mail to the sink", async () => {
		// A staging run must never reach a real reader's inbox.
		await mail(() =>
			service("development").sendVerificationEmail({
				to: READER,
				name: "Valere",
				url: "https://dailybriefs.fr/verify?token=abc",
			}),
		);

		expect(sent().to).toBe(SINK);
		expect(logger.info).toHaveBeenCalledWith(
			expect.objectContaining({ redirected: true }),
			"Email sent",
		);
	});

	it("treats anything that is not exactly `production` as not production", async () => {
		// The check is an exact match, so a misspelt setting fails safe.
		await mail(() =>
			service("Production").sendVerificationEmail({
				to: READER,
				name: "Valere",
				url: "https://dailybriefs.fr/verify?token=abc",
			}),
		);

		expect(sent().to).toBe(SINK);
	});

	it("redirects the contact message too, reply-to included", async () => {
		await mail(() =>
			service("staging").sendContactMessage({
				to: OPERATOR_INBOX,
				fromEmail: READER,
				subject: "A source worth adding",
				message: "You are missing a good feed.",
			}),
		);

		expect(sent()).toMatchObject({ to: SINK, replyTo: READER });
	});
});

describe("a refused send", () => {
	it("reports the reason Resend gave", async () => {
		// Resend answers with an error field rather than throwing, so an
		// unchecked send would look like a delivered mail.
		send.mockResolvedValue({
			data: null,
			error: { name: "validation_error", message: "Invalid `to` field" },
		});

		await expect(
			mail(() =>
				service("production").sendVerificationEmail({
					to: "not-an-address",
					name: "Valere",
					url: "https://dailybriefs.fr/verify?token=abc",
				}),
			),
		).rejects.toMatchObject({
			code: "MAIL_SEND_FAILED",
			message: "Invalid `to` field",
		});

		expect(logger.error).toHaveBeenCalledOnce();
		expect(logger.info).not.toHaveBeenCalled();
	});
});
