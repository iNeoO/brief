import {
	CONTACT_HONEYPOT_FIELD,
	CONTACT_MESSAGE_MAX_LENGTH,
	CONTACT_MESSAGE_MIN_LENGTH,
	CONTACT_SUBJECT_MAX_LENGTH,
} from "@brief/common/constants";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { env } from "#/config/env";
import { containerMiddleware } from "#/libs/server/middleware";
import { enforceRateLimit } from "#/libs/server/rate-limit";
import { attempt } from "#/libs/server/result";

const sendContactMessageInput = z.object({
	email: z.email(),
	subject: z.string().trim().min(1).max(CONTACT_SUBJECT_MAX_LENGTH),
	message: z
		.string()
		.trim()
		.min(CONTACT_MESSAGE_MIN_LENGTH)
		.max(CONTACT_MESSAGE_MAX_LENGTH),
	// The trap field. Optional because a real browser posts it as an empty
	// string and an older cached page may not post it at all.
	[CONTACT_HONEYPOT_FIELD]: z.string().max(0).optional(),
});

/**
 * The one write an anonymous visitor can reach. Three things stand between it
 * and a spam relay, in this order: the rate limit, which is charged even to a
 * caller the honeypot is about to unmask, so hammering the endpoint gains
 * nothing; the honeypot itself; and the escaping in the template, which is
 * what keeps a typed `<script>` from reaching the operator's mail client.
 *
 * A trapped submission answers `{ sent: true }` like any other. Telling a bot
 * it was caught is telling it which field to leave alone next time.
 */
export const sendContactMessage = createServerFn({ method: "POST" })
	.middleware([containerMiddleware])
	.validator(sendContactMessageInput)
	.handler(({ data, context }) =>
		attempt(async () => {
			await enforceRateLimit(
				context.container.redis,
				"sendContactMessage",
				data.email,
			);

			if (data[CONTACT_HONEYPOT_FIELD]) {
				return { sent: true };
			}

			await context.container.mailService.sendContactMessage({
				to: env.CONTACT_INBOX_EMAIL,
				fromEmail: data.email,
				subject: data.subject,
				message: data.message,
			});

			return { sent: true };
		}),
	);
