import { BRAND_NAME } from "@brief/common/constants";
import { escape as escapeHtml } from "html-escaper";
import type { ContactMessageEmailInput } from "../mail.type.js";

/**
 * The notification the operator receives when someone writes from `/contact`.
 * It does not reuse `getEmailShellTemplate`: that shell is built around a call
 * to action button, and this mail has nothing to click — it carries a message
 * to read and an address to answer.
 *
 * Everything the visitor typed is escaped before it reaches the markup. The
 * body is the one field where newlines matter, so they become `<br />` *after*
 * escaping; doing it the other way round would let a typed `<br>` through.
 */
export const getContactMessageEmailTemplate = ({
	fromEmail,
	subject,
	message,
}: Omit<ContactMessageEmailInput, "to">) => {
	const safeFrom = escapeHtml(fromEmail);
	const safeSubject = escapeHtml(subject);
	const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br />");

	return {
		// Prefixed so the operator's own inbox rules can catch it, and so a reply
		// keeps the thread recognisable next to the transactional mail.
		subject: `[${BRAND_NAME}] ${subject}`,
		html: `<!doctype html>
<html lang="en">
	<body style="margin:0;padding:24px;background:#0f1115;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#171a21;border-radius:12px;">
			<tr>
				<td style="padding:32px;">
					<p style="margin:0 0 24px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#7c8598;">${escapeHtml(BRAND_NAME)} — contact</p>
					<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#f2f4f8;">${safeSubject}</h1>
					<p style="margin:0 0 24px;font-size:15px;color:#c2c9d6;">From <a href="mailto:${safeFrom}" style="color:#4f7cff;text-decoration:none;">${safeFrom}</a></p>
					<div style="margin:0;padding:20px;border-radius:8px;background:#0f1115;font-size:15px;line-height:1.6;color:#c2c9d6;">${safeMessage}</div>
					<p style="margin:24px 0 0;padding-top:24px;border-top:1px solid #232833;font-size:13px;line-height:1.6;color:#7c8598;">Reply to this mail to answer ${safeFrom} directly.</p>
				</td>
			</tr>
		</table>
	</body>
</html>`,
	};
};
