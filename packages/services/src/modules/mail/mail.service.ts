import { INTERNAL_ERROR_CODE } from "@brief/common/constants";
import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";
import { Resend } from "resend";
import type {
	ContactMessageEmailInput,
	MailServiceConfig,
	ResetPasswordEmailInput,
	SendMailInput,
	VerificationEmailInput,
} from "./mail.type.js";
import { getContactMessageEmailTemplate } from "./templates/contactMessage.template.js";
import { getResetPasswordEmailTemplate } from "./templates/resetPasswordEmail.template.js";
import { getVerificationEmailTemplate } from "./templates/verificationEmail.template.js";

const SINK_RECIPIENT = "delivered@resend.dev";

export class MailService {
	private client: Resend;
	private from: string;
	private isProduction: boolean;

	constructor(config: MailServiceConfig) {
		this.client = new Resend(config.apiKey);
		this.from = config.from;
		this.isProduction = config.nodeEnv === "production";
	}

	private async send({ to, subject, html, replyTo }: SendMailInput) {
		const recipient = this.isProduction ? to : SINK_RECIPIENT;
		const logger = getLoggerStore();

		const { error } = await this.client.emails.send({
			from: this.from,
			to: recipient,
			subject,
			html,
			...(replyTo && { replyTo }),
		});

		if (error) {
			logger.error({ err: error, subject }, "Failed to send email");
			throw new InternalError({
				code: INTERNAL_ERROR_CODE.MAIL_SEND_FAILED,
				message: error.message,
			});
		}

		logger.info({ subject, redirected: !this.isProduction }, "Email sent");
	}

	sendVerificationEmail({ to, name, url }: VerificationEmailInput) {
		const { subject, html } = getVerificationEmailTemplate({ name, url });
		return this.send({ to, subject, html });
	}

	sendResetPasswordEmail({ to, name, url }: ResetPasswordEmailInput) {
		const { subject, html } = getResetPasswordEmailTemplate({ name, url });
		return this.send({ to, subject, html });
	}

	/**
	 * A message from the public contact form, to the operator's inbox. The
	 * visitor's address is the reply-to and never the from: sending as a domain
	 * we do not sign for is what gets a mail filed as spam, when it arrives.
	 */
	sendContactMessage({
		to,
		fromEmail,
		subject,
		message,
	}: ContactMessageEmailInput) {
		const template = getContactMessageEmailTemplate({
			fromEmail,
			subject,
			message,
		});

		return this.send({ to, ...template, replyTo: fromEmail });
	}
}
