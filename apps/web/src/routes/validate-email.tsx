import { Button, Loader, Stack, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthCard, AuthNotice } from "#/components/auth/auth-card";
import { ROUTES } from "#/config/routes";
import { verifyEmail } from "#/libs/api/auth";
import { unwrap } from "#/libs/api/unwrap";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedTitle } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/validate-email")({
	loader: localeLoader,
	head: localisedTitle((d) => d.auth.validateEmail.pageTitle),
	/*
	 * The link better-auth mails out is
	 * `/validate-email?token=<jwt>&callbackURL=%2F`. Only the token is read:
	 * `callbackURL` exists for better-auth's own mounted router, which this app
	 * never mounts, and forwarding it would ask the API to answer with a
	 * redirect instead of a result.
	 */
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : undefined,
	}),
	component: ValidateEmailPage,
});

function ValidateEmailPage() {
	const { token } = Route.useSearch();

	return token ? <VerifyToken token={token} /> : <MissingToken />;
}

function MissingToken() {
	const { t } = useI18n();

	return (
		<AuthCard title={t.auth.validateEmail.pageTitle}>
			<AuthNotice
				title={t.auth.validateEmail.missingToken.title}
				body={t.auth.validateEmail.missingToken.body}
			>
				<Button component={Link} to={ROUTES.signIn} size="sm" variant="default">
					{t.auth.validateEmail.failed.cta}
				</Button>
			</AuthNotice>
		</AuthCard>
	);
}

function VerifyToken({ token }: { token: string }) {
	const { t } = useI18n();

	/*
	 * A query rather than a mutation, on purpose. This has to fire by itself when
	 * the page opens, and a query keyed on the token runs exactly once for it —
	 * where a mutation kicked off from an effect would fire twice under
	 * StrictMode, and the second attempt would fail on an already-spent token
	 * and report a failure over a success.
	 */
	const verification = useQuery({
		queryKey: ["auth", "verify-email", token],
		queryFn: () => verifyEmail({ data: { token } }).then(unwrap),
		retry: false,
		staleTime: Number.POSITIVE_INFINITY,
	});

	if (verification.isPending) {
		return (
			<AuthCard title={t.auth.validateEmail.pageTitle}>
				<Stack align="center" gap="md" py="xl">
					<Loader size="sm" />
					<Text c="dimmed" size="sm">
						{t.auth.validateEmail.pending}
					</Text>
				</Stack>
			</AuthCard>
		);
	}

	if (verification.isError) {
		return (
			<AuthCard title={t.auth.validateEmail.pageTitle}>
				<AuthNotice
					title={t.auth.validateEmail.failed.title}
					body={t.auth.validateEmail.failed.body}
				>
					<Button component={Link} to={ROUTES.signIn} size="sm">
						{t.auth.validateEmail.failed.cta}
					</Button>
				</AuthNotice>
			</AuthCard>
		);
	}

	return (
		<AuthCard title={t.auth.validateEmail.pageTitle}>
			<AuthNotice
				title={t.auth.validateEmail.done.title}
				body={t.auth.validateEmail.done.body}
			>
				<Button component={Link} to={ROUTES.signIn} size="sm">
					{t.auth.validateEmail.done.cta}
				</Button>
			</AuthNotice>
		</AuthCard>
	);
}
