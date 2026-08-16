import {
	Anchor,
	Button,
	Checkbox,
	PasswordInput,
	Stack,
	TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthCard } from "#/components/auth/auth-card";
import { FormError } from "#/components/auth/form-feedback";
import classes from "#/components/shell/shell.module.css";
import { ROUTES } from "#/config/routes";
import {
	sendVerificationEmail,
	sessionQueryKey,
	signInWithEmailAndPassword,
} from "#/libs/api/auth";
import { unwrap } from "#/libs/api/unwrap";
import { getErrorStatus, resolveErrorMessage } from "#/libs/auth/error-message";
import { redirectIfAuthenticated } from "#/libs/auth/guards";
import { safeRedirectPath } from "#/libs/auth/redirect";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedTitle } from "#/libs/i18n/route-head";
import { notifyError } from "#/libs/notify";

export const Route = createFileRoute("/sign-in")({
	loader: localeLoader,
	head: localisedTitle((d) => d.auth.signIn.title),
	// Search params are untrusted: narrow to the one key this page reads.
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	beforeLoad: ({ context, search }) =>
		redirectIfAuthenticated({
			queryClient: context.queryClient,
			to: safeRedirectPath(search.redirect),
		}),
	component: SignInPage,
});

function SignInPage() {
	const { t } = useI18n();
	const search = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: { email: "", password: "", rememberMe: true },
		validate: {
			email: (value) => {
				if (!value.trim()) return t.auth.validation.emailRequired;
				return /^\S+@\S+\.\S+$/.test(value)
					? null
					: t.auth.validation.emailInvalid;
			},
			password: (value) => (value ? null : t.auth.validation.passwordRequired),
		},
	});

	const signIn = useMutation({
		mutationFn: (values: typeof form.values) =>
			signInWithEmailAndPassword({ data: values }).then(unwrap),
		onSuccess: (session) => {
			// The server function already returns the fresh session, so seed the
			// cache with it instead of making the next guard fetch it again.
			queryClient.setQueryData(sessionQueryKey, session);
			navigate({ href: safeRedirectPath(search.redirect) });
		},
		onError: (error) => {
			// 403 is not a flash message: it is a state with a resend button
			// attached, rendered inline below where it will not vanish.
			if (getErrorStatus(error) === 403) {
				return;
			}

			notifyError(
				resolveErrorMessage(
					error,
					{
						401: t.auth.signIn.invalidCredentials,
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

	// better-auth answers 403 when the address exists but is not confirmed yet.
	const needsVerification = getErrorStatus(signIn.error) === 403;

	return (
		<AuthCard
			title={t.auth.signIn.title}
			lead={t.auth.signIn.lead}
			footer={
				<>
					{t.auth.signIn.noAccount}{" "}
					<Anchor component={Link} to={ROUTES.signUp} underline="always">
						{t.auth.signIn.createAccount}
					</Anchor>
				</>
			}
		>
			<form onSubmit={form.onSubmit((values) => signIn.mutate(values))}>
				<Stack gap="md">
					{needsVerification ? (
						<FormError>
							<Stack gap="sm" align="flex-start">
								<span>{t.auth.signIn.emailNotVerified}</span>

								{resendVerification.isSuccess ? (
									<strong>{t.auth.signIn.resent}</strong>
								) : (
									<Button
										variant="default"
										size="xs"
										loading={resendVerification.isPending}
										onClick={() =>
											resendVerification.mutate(form.getValues().email)
										}
									>
										{t.auth.signIn.resend}
									</Button>
								)}
							</Stack>
						</FormError>
					) : null}

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
						autoComplete="current-password"
						required
					/>

					<div className={classes.formActions}>
						<Checkbox
							{...form.getInputProps("rememberMe", { type: "checkbox" })}
							key={form.key("rememberMe")}
							label={t.auth.signIn.rememberMe}
						/>

						<Anchor
							component={Link}
							to={ROUTES.forgotPassword}
							size="sm"
							underline="always"
						>
							{t.auth.signIn.forgotPassword}
						</Anchor>
					</div>

					<Button type="submit" size="md" loading={signIn.isPending} fullWidth>
						{t.auth.signIn.submit}
					</Button>
				</Stack>
			</form>
		</AuthCard>
	);
}
