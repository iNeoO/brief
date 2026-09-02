import {
	CONTACT_EMAIL,
	CONTACT_HONEYPOT_FIELD,
	CONTACT_MESSAGE_MAX_LENGTH,
	CONTACT_MESSAGE_MIN_LENGTH,
	CONTACT_SUBJECT_MAX_LENGTH,
	SIGNUP_ENABLED,
} from "@brief/common/constants";
import { Button, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import classes from "#/components/document/contact-form.module.css";
import { DocumentPage } from "#/components/document/document";
import { SiteShell } from "#/components/layout/site-shell";
import { Notice } from "#/components/notice";
import { ROUTES } from "#/config/routes";
import { sendContactMessage } from "#/libs/api/contact";
import { unwrap } from "#/libs/api/unwrap";
import { resolveErrorMessage } from "#/libs/auth/error-message";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedHead } from "#/libs/i18n/route-head";
import { notifyError } from "#/libs/notify";

export const Route = createFileRoute("/contact")({
	loader: localeLoader,
	head: localisedHead((t) => ({
		title: t.contact.title,
		description: t.contact.lead,
		path: ROUTES.contact,
	})),
	component: ContactPage,
});

function ContactPage() {
	const { t } = useI18n();
	const page = t.contact;

	// The account request is the reason most people write while sign-up is shut.
	// Tied to the flag rather than written into the lead, so reopening sign-up
	// does not leave the page claiming something that stopped being true.
	const lead = SIGNUP_ENABLED
		? page.lead
		: `${page.lead} ${page.leadSignUpClosed}`;

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			email: "",
			subject: "",
			message: "",
			[CONTACT_HONEYPOT_FIELD]: "",
		},
		validate: {
			email: (value) => {
				if (!value.trim()) return page.validation.emailRequired;
				return /^\S+@\S+\.\S+$/.test(value)
					? null
					: page.validation.emailInvalid;
			},
			subject: (value) =>
				value.trim() ? null : page.validation.subjectRequired,
			message: (value) => {
				const trimmed = value.trim();

				if (trimmed.length < CONTACT_MESSAGE_MIN_LENGTH) {
					return page.validation.messageTooShort(CONTACT_MESSAGE_MIN_LENGTH);
				}

				return trimmed.length > CONTACT_MESSAGE_MAX_LENGTH
					? page.validation.messageTooLong(CONTACT_MESSAGE_MAX_LENGTH)
					: null;
			},
		},
	});

	const send = useMutation({
		mutationFn: (values: typeof form.values) =>
			sendContactMessage({ data: values }).then(unwrap),
		onError: (error) => {
			notifyError(
				resolveErrorMessage(
					error,
					{ 429: page.tooManyRequests },
					page.genericError,
				),
			);
		},
	});

	if (send.isSuccess) {
		return (
			<SiteShell>
				<DocumentPage title={page.title} lead={lead}>
					<Notice
						variant="panel"
						title={page.sent.title}
						body={page.sent.body}
						className={classes.form}
					/>
				</DocumentPage>
			</SiteShell>
		);
	}

	return (
		<SiteShell>
			<DocumentPage title={page.title} lead={lead}>
				<form
					className={classes.form}
					onSubmit={form.onSubmit((values) => send.mutate(values))}
					noValidate
				>
					<Stack gap="md">
						<TextInput
							label={page.form.email}
							placeholder={page.form.emailPlaceholder}
							type="email"
							autoComplete="email"
							withAsterisk
							{...form.getInputProps("email")}
						/>

						<TextInput
							label={page.form.subject}
							placeholder={page.form.subjectPlaceholder}
							maxLength={CONTACT_SUBJECT_MAX_LENGTH}
							withAsterisk
							{...form.getInputProps("subject")}
						/>

						<Textarea
							label={page.form.message}
							placeholder={page.form.messagePlaceholder}
							maxLength={CONTACT_MESSAGE_MAX_LENGTH}
							autosize
							minRows={6}
							withAsterisk
							{...form.getInputProps("message")}
						/>

						<div className={classes.honeypot} aria-hidden="true">
							<label htmlFor={CONTACT_HONEYPOT_FIELD}>
								{/* Never read by anyone: see the stylesheet. */}
								Leave this field empty
								<input
									id={CONTACT_HONEYPOT_FIELD}
									name={CONTACT_HONEYPOT_FIELD}
									type="text"
									tabIndex={-1}
									autoComplete="off"
									{...form.getInputProps(CONTACT_HONEYPOT_FIELD)}
								/>
							</label>
						</div>

						<Button type="submit" loading={send.isPending}>
							{send.isPending ? page.form.submitting : page.form.submit}
						</Button>
					</Stack>
				</form>

				<p className={classes.direct}>{page.direct(CONTACT_EMAIL)}</p>
			</DocumentPage>
		</SiteShell>
	);
}
