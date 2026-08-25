import { Anchor, Button, PasswordInput, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthCard } from "#/components/auth/auth-card";
import { FormError } from "#/components/auth/form-feedback";
import { Notice } from "#/components/notice";
import { ROUTES } from "#/config/routes";
import { resetPassword } from "#/libs/api/auth";
import { unwrap } from "#/libs/api/unwrap";
import { getErrorStatus, resolveErrorMessage } from "#/libs/auth/error-message";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedHead } from "#/libs/i18n/route-head";
import { notifyError } from "#/libs/notify";

const MIN_PASSWORD_LENGTH = 8;

const SPENT_TOKEN_STATUSES = new Set([400, 401, 403]);

const isSpentToken = (error: unknown) =>
	SPENT_TOKEN_STATUSES.has(getErrorStatus(error) ?? 0);

export const Route = createFileRoute("/reset-password")({
	loader: localeLoader,
	head: localisedHead((t) => ({
		title: t.auth.resetPassword.title,
		path: ROUTES.resetPassword,
		noindex: true,
	})),
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : undefined,
	}),
	component: ResetPasswordPage,
});

function ResetPasswordPage() {
	const { token } = Route.useSearch();

	return token ? <ResetPasswordForm token={token} /> : <MissingToken />;
}

function MissingToken() {
	const { t } = useI18n();

	return (
		<AuthCard title={t.auth.resetPassword.title}>
			<Notice
				variant="panel"
				title={t.auth.resetPassword.missingToken.title}
				body={t.auth.resetPassword.missingToken.body}
			>
				<Anchor component={Link} to={ROUTES.forgotPassword} underline="always">
					{t.auth.resetPassword.requestNew}
				</Anchor>
			</Notice>
		</AuthCard>
	);
}

function ResetPasswordForm({ token }: { token: string }) {
	const { t } = useI18n();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: { password: "", confirmPassword: "" },
		validate: {
			password: (value) =>
				value.length >= MIN_PASSWORD_LENGTH
					? null
					: t.auth.validation.passwordTooShort,
			confirmPassword: (value, values) =>
				value === values.password ? null : t.auth.validation.passwordMismatch,
		},
	});

	const reset = useMutation({
		mutationFn: (newPassword: string) =>
			resetPassword({ data: { token, newPassword } }).then(unwrap),
		onError: (error) => {
			if (isSpentToken(error)) {
				return;
			}

			notifyError(
				resolveErrorMessage(
					error,
					{ 429: t.auth.tooManyRequests },
					t.auth.genericError,
				),
			);
		},
	});

	if (reset.isSuccess) {
		return (
			<AuthCard title={t.auth.resetPassword.title}>
				<Notice
					variant="panel"
					title={t.auth.resetPassword.done.title}
					body={t.auth.resetPassword.done.body}
				>
					<Button component={Link} to={ROUTES.signIn} size="sm">
						{t.auth.resetPassword.done.cta}
					</Button>
				</Notice>
			</AuthCard>
		);
	}

	return (
		<AuthCard
			title={t.auth.resetPassword.title}
			lead={t.auth.resetPassword.lead}
		>
			<form onSubmit={form.onSubmit((values) => reset.mutate(values.password))}>
				<Stack gap="md">
					{isSpentToken(reset.error) ? (
						<FormError>
							<Stack gap="sm" align="flex-start">
								<span>{t.auth.resetPassword.invalidToken}</span>

								<Anchor
									component={Link}
									to={ROUTES.forgotPassword}
									underline="always"
								>
									{t.auth.resetPassword.requestNew}
								</Anchor>
							</Stack>
						</FormError>
					) : null}

					<PasswordInput
						{...form.getInputProps("password")}
						key={form.key("password")}
						label={t.auth.fields.newPassword}
						description={t.auth.fields.passwordHint}
						autoComplete="new-password"
						required
					/>

					<PasswordInput
						{...form.getInputProps("confirmPassword")}
						key={form.key("confirmPassword")}
						label={t.auth.fields.confirmPassword}
						autoComplete="new-password"
						required
					/>

					<Button type="submit" size="md" loading={reset.isPending} fullWidth>
						{t.auth.resetPassword.submit}
					</Button>
				</Stack>
			</form>
		</AuthCard>
	);
}
