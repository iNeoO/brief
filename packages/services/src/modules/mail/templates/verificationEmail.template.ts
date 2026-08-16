import type { EmailTemplate } from "../mail.type.js";
import { getEmailShellTemplate } from "./emailShell.template.js";

export const getVerificationEmailTemplate = ({
	name,
	url,
}: {
	name: string;
	url: string;
}): EmailTemplate => ({
	subject: "Confirm your email address",
	html: getEmailShellTemplate({
		title: "Confirm your email address",
		greeting: `Hi ${name},`,
		intro:
			"One last step before your briefs start arriving: confirm this address is really yours.",
		buttonLabel: "Confirm my address",
		buttonUrl: url,
		notice:
			"If you didn't sign up, just ignore this email: no account will be activated.",
	}),
});
