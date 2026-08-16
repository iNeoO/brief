import { Anchor, Button, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthCard, AuthNotice } from "#/components/auth/auth-card";
import { ROUTES } from "#/config/routes";
import { requestPasswordReset } from "#/libs/api/auth";
import { unwrap } from "#/libs/api/unwrap";
import { resolveErrorMessage } from "#/libs/auth/error-message";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedTitle } from "#/libs/i18n/route-head";
import { notifyError } from "#/libs/notify";

export const Route = createFileRoute("/forgot-password")({
	loader: localeLoader,
	head: localisedTitle((d) => d.auth.forgotPassword.title),
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const { t } = useI18n();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: { email: "" },
		validate: {
			email: (value) => {
				if (!value.trim()) return t.auth.validation.emailRequired;
				return /^\S+@\S+\.\S+$/.test(value)
					? null
					: t.auth.validation.emailInvalid;
			},
		},
	});

	const request = useMutation({
		mutationFn: (email: string) =>
			requestPasswordReset({
				data: { email, redirectTo: ROUTES.resetPassword },
			}).then(unwrap),
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

	/*
	 * The confirmation is identical whether or not the address has an account.
	 * Saying "no account with that email" here would turn this form into a way
	 * to test which addresses are registered.
	 */
	if (request.isSuccess) {
		return (
			<AuthCard title={t.auth.forgotPassword.title}>
				<AuthNotice
					title={t.auth.forgotPassword.sent.title}
					body={t.auth.forgotPassword.sent.body}
				>
					<Anchor component={Link} to={ROUTES.signIn} underline="always">
						{t.auth.forgotPassword.backToSignIn}
					</Anchor>
				</AuthNotice>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			title={t.auth.forgotPassword.title}
			lead={t.auth.forgotPassword.lead}
			footer={
				<Anchor component={Link} to={ROUTES.signIn} underline="always">
					{t.auth.forgotPassword.backToSignIn}
				</Anchor>
			}
		>
			<form onSubmit={form.onSubmit((values) => request.mutate(values.email))}>
				<Stack gap="md">
					<TextInput
						{...form.getInputProps("email")}
						key={form.key("email")}
						label={t.auth.fields.email}
						type="email"
						autoComplete="email"
						required
					/>

					<Button type="submit" size="md" loading={request.isPending} fullWidth>
						{t.auth.forgotPassword.submit}
					</Button>
				</Stack>
			</form>
		</AuthCard>
	);
}
