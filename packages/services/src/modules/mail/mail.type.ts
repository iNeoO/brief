export type MailServiceConfig = {
	apiKey: string;
	from: string;
	nodeEnv: string;
};

export type SendMailInput = {
	to: string;
	subject: string;
	html: string;
};

export type VerificationEmailInput = {
	to: string;
	name: string;
	url: string;
};

export type ResetPasswordEmailInput = VerificationEmailInput;

export type EmailTemplate = {
	subject: string;
	html: string;
};
