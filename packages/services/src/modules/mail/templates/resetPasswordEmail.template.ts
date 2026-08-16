import type { EmailTemplate } from "../mail.type.js";
import { getEmailShellTemplate } from "./emailShell.template.js";

export const getResetPasswordEmailTemplate = ({
	name,
	url,
}: {
	name: string;
	url: string;
}): EmailTemplate => ({
	subject: "Reset your password",
	html: getEmailShellTemplate({
		title: "Reset your password",
		greeting: `Hi ${name},`,
		intro:
			"You asked to change your password. This link expires shortly and can only be used once.",
		buttonLabel: "Choose a new password",
		buttonUrl: url,
		notice:
			"If you didn't request this, ignore this email: your current password stays valid.",
	}),
});
