import { escape as escapeHtml } from "html-escaper";

type EmailShellInput = {
	title: string;
	intro: string;
	buttonLabel: string;
	buttonUrl: string;
	notice: string;
	greeting: string;
};

export const getEmailShellTemplate = (input: EmailShellInput) => {
	const title = escapeHtml(input.title);
	const intro = escapeHtml(input.intro);
	const buttonLabel = escapeHtml(input.buttonLabel);
	const buttonUrl = escapeHtml(input.buttonUrl);
	const notice = escapeHtml(input.notice);
	const greeting = escapeHtml(input.greeting);

	return `<!doctype html>
<html lang="en">
	<body style="margin:0;padding:24px;background:#0f1115;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#171a21;border-radius:12px;">
			<tr>
				<td style="padding:32px;">
					<p style="margin:0 0 24px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#7c8598;">Brief</p>
					<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#f2f4f8;">${title}</h1>
					<p style="margin:0 0 8px;font-size:15px;color:#c2c9d6;">${greeting}</p>
					<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#c2c9d6;">${intro}</p>
					<a href="${buttonUrl}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#4f7cff;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">${buttonLabel}</a>
					<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#7c8598;">If the button doesn't work, copy this link:<br /><span style="color:#9aa4b8;word-break:break-all;">${buttonUrl}</span></p>
					<p style="margin:24px 0 0;padding-top:24px;border-top:1px solid #232833;font-size:13px;line-height:1.6;color:#7c8598;">${notice}</p>
				</td>
			</tr>
		</table>
	</body>
</html>`;
};
