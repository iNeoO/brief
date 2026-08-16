import { USER_NAME_MAX_LENGTH } from "@brief/common/constants";
import { Anchor, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthCard, AuthNotice } from "#/components/auth/auth-card";
import { FormNote } from "#/components/auth/form-feedback";
import { ROUTES } from "#/config/routes";
import {
	sendVerificationEmail,
	signUpWithEmailAndPassword,
} from "#/libs/api/auth";
import { unwrap } from "#/libs/api/unwrap";
import { resolveErrorMessage } from "#/libs/auth/error-message";
import { redirectIfAuthenticated } from "#/libs/auth/guards";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedTitle } from "#/libs/i18n/route-head";
import { notifyError } from "#/libs/notify";

const MIN_PASSWORD_LENGTH = 8;

export const Route = createFileRoute("/sign-up")({
	loader: localeLoader,
	head: localisedTitle((d) => d.auth.signUp.title),
	beforeLoad: ({ context }) =>
		redirectIfAuthenticated({
			queryClient: context.queryClient,
			to: ROUTES.home,
		}),
	component: SignUpPage,
});

function SignUpPage() {
	const { t } = useI18n();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: { name: "", email: "", password: "" },
		validate: {
			name: (value) => (value.trim() ? null : t.auth.validation.nameRequired),
			email: (value) => {
				if (!value.trim()) return t.auth.validation.emailRequired;
				return /^\S+@\S+\.\S+$/.test(value)
					? null
					: t.auth.validation.emailInvalid;
			},
			// Mirrors the server's zod rule; the server stays the real gate.
			password: (value) =>
				value.length >= MIN_PASSWORD_LENGTH
					? null
					: t.auth.validation.passwordTooShort,
		},
	});

	const signUp = useMutation({
		mutationFn: (values: typeof form.values) =>
			signUpWithEmailAndPassword({ data: values }).then(unwrap),
		onError: (error) => {
			notifyError(
				resolveErrorMessage(
					error,
					{
						409: t.auth.signUp.emailTaken,
						422: t.auth.signUp.emailTaken,
						429: t.auth.tooManyRequests,
					},
					t.auth.genericError,
				),
			);
		},
	});

	const resendVerification = useMutation({
		mutationFn: (email: string) =>
			sendVerificationEmail({ data: { email } }).then(unwrap),
		onError: (error) => {
			notifyError(
				resolveErrorMessage(
					error,
					{ 429: t.auth.tooManyRequests },
					t.auth.genericError,
				),
			);
		},
	});

	// Sign-up does not sign anyone in: verification is required first.
	if (signUp.isSuccess) {
		const email = form.getValues().email;

		return (
			<AuthCard title={t.auth.signUp.title}>
				<AuthNotice
					title={t.auth.signUp.checkInbox.title}
					body={t.auth.signUp.checkInbox.body(email)}
				>
					{resendVerification.isSuccess ? (
						<FormNote>{t.auth.signUp.checkInbox.resent}</FormNote>
					) : (
						<Button
							variant="default"
							size="sm"
							loading={resendVerification.isPending}
							onClick={() => resendVerification.mutate(email)}
						>
							{t.auth.signUp.checkInbox.resend}
						</Button>
					)}

					<Anchor component={Link} to={ROUTES.signIn} underline="always">
						{t.auth.signUp.signIn}
					</Anchor>
				</AuthNotice>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			title={t.auth.signUp.title}
			lead={t.auth.signUp.lead}
			footer={
				<>
					{t.auth.signUp.hasAccount}{" "}
					<Anchor component={Link} to={ROUTES.signIn} underline="always">
						{t.auth.signUp.signIn}
					</Anchor>
				</>
			}
		>
			<form onSubmit={form.onSubmit((values) => signUp.mutate(values))}>
				<Stack gap="md">
					<TextInput
						{...form.getInputProps("name")}
						key={form.key("name")}
						label={t.auth.fields.name}
						autoComplete="name"
						maxLength={USER_NAME_MAX_LENGTH}
						required
					/>

					<TextInput
						{...form.getInputProps("email")}
						key={form.key("email")}
						label={t.auth.fields.email}
						type="email"
						autoComplete="email"
						required
					/>

					<PasswordInput
						{...form.getInputProps("password")}
						key={form.key("password")}
						label={t.auth.fields.password}
						description={t.auth.fields.passwordHint}
						autoComplete="new-password"
						required
					/>

					<Button type="submit" size="md" loading={signUp.isPending} fullWidth>
						{t.auth.signUp.submit}
					</Button>
				</Stack>
			</form>
		</AuthCard>
	);
}
