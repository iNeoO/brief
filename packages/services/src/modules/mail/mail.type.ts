export type MailServiceConfig = {
	apiKey: string;
	from: string;
	nodeEnv: string;
};

export type SendMailInput = {
	to: string;
	subject: string;
	html: string;
	/**
	 * Where a reply goes, when that is not the sender. Only the contact form
	 * uses it: the mail must leave from our own authenticated domain to pass
	 * SPF and DKIM, so the visitor's address rides here instead of in `from`.
	 */
	replyTo?: string;
};

export type VerificationEmailInput = {
	to: string;
	name: string;
	url: string;
};

export type ResetPasswordEmailInput = VerificationEmailInput;

export type ContactMessageEmailInput = {
	/** The operator's inbox, not the visitor's address. */
	to: string;
	fromEmail: string;
	subject: string;
	message: string;
};

export type EmailTemplate = {
	subject: string;
	html: string;
};
