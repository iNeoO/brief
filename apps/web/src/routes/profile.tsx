import { USER_NAME_MAX_LENGTH, USER_ROLE } from "@brief/common/constants";
import {
	Anchor,
	Badge,
	Button,
	Group,
	PasswordInput,
	Stack,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { SiteShell } from "#/components/layout/site-shell";
import classes from "#/components/profile/profile.module.css";
import { WhatsappSection } from "#/components/profile/whatsapp-section";
import shellClasses from "#/components/shell/shell.module.css";
import topicClasses from "#/components/topics/topics.module.css";
import { ROUTES } from "#/config/routes";
import {
	type AuthSession,
	changePassword,
	sessionQueryKey,
	sessionQueryOptions,
	updateProfile,
} from "#/libs/api/auth";
import { unwrap } from "#/libs/api/unwrap";
import { resolveErrorMessage } from "#/libs/auth/error-message";
import { requireUser } from "#/libs/auth/guards";
import { safeRedirectPath } from "#/libs/auth/redirect";
import { formatDate } from "#/libs/format/date";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedHead } from "#/libs/i18n/route-head";
import { notifyError, notifySuccess } from "#/libs/notify";

const MIN_PASSWORD_LENGTH = 8;

const profileSearchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/profile")({
	// Set when a reader is sent here mid-task — after a first subscription, which
	// is the point at which a brief has somewhere to be delivered.
	validateSearch: profileSearchSchema,
	loader: localeLoader,
	head: localisedHead((t) => ({
		title: t.auth.profile.title,
		path: ROUTES.profile,
		noindex: true,
	})),
	beforeLoad: ({ context, location }) =>
		requireUser({ queryClient: context.queryClient, href: location.href }),
	component: ProfilePage,
});

function ProfilePage() {
	const { t } = useI18n();
	const labels = t.auth.profile;
	const { redirect } = Route.useSearch();
	const { data: session } = useQuery(sessionQueryOptions());
	const user = session?.user;

	return (
		<SiteShell>
			<div className={`brief-shell ${shellClasses.appMain}`}>
				<Anchor
					component={Link}
					to={ROUTES.home}
					className={topicClasses.backLink}
				>
					{labels.back}
				</Anchor>

				<Title order={1} className={shellClasses.appHeading}>
					{labels.title}
				</Title>
				<p className={shellClasses.appMeta}>{labels.lead}</p>

				{user ? (
					<div className={classes.sections}>
						<AccountSummary user={user} />
						<WhatsappSection
							returnTo={redirect ? safeRedirectPath(redirect) : undefined}
						/>
						<NameForm name={user.name} />
						<PasswordForm email={user.email} />
					</div>
				) : null}
			</div>
		</SiteShell>
	);
}

type SessionUser = NonNullable<AuthSession>["user"];

function AccountSummary({ user }: { user: SessionUser }) {
	const { locale, t } = useI18n();
	const labels = t.auth.profile.account;

	return (
		<section className={classes.section}>
			<h2 className={classes.sectionTitle}>{labels.title}</h2>

			<dl className={classes.details}>
				<div className={classes.detail}>
					<dt className={classes.detailLabel}>{labels.email}</dt>
					<dd className={classes.detailValue}>
						{user.email}
						<Badge
							size="sm"
							variant="light"
							color={user.emailVerified ? "teal" : "gray"}
						>
							{user.emailVerified
								? labels.emailVerified
								: labels.emailUnverified}
						</Badge>
					</dd>
				</div>

				<div className={classes.detail}>
					<dt className={classes.detailLabel}>{labels.role}</dt>
					<dd className={classes.detailValue}>
						{user.role === USER_ROLE.ADMIN
							? labels.roles.admin
							: labels.roles.user}
					</dd>
				</div>

				<div className={classes.detail}>
					<dt className={classes.detailLabel}>{labels.memberSince}</dt>
					<dd className={classes.detailValue}>
						{formatDate(new Date(user.createdAt), locale, "long")}
					</dd>
				</div>
			</dl>
		</section>
	);
}

function NameForm({ name }: { name: string }) {
	const { t } = useI18n();
	const labels = t.auth.profile.identity;
	const queryClient = useQueryClient();

	const form = useForm({
		mode: "uncontrolled",
		initialValues: { name },
		validate: {
			name: (value) => (value.trim() ? null : t.auth.validation.nameRequired),
		},
	});

	const save = useMutation({
		mutationFn: (values: typeof form.values) =>
			updateProfile({ data: values }).then(unwrap),
		onSuccess: (refreshed) => {
			queryClient.setQueryData(sessionQueryKey, refreshed);
			notifySuccess(labels.success);
		},
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

	return (
		<section className={classes.section}>
			<h2 className={classes.sectionTitle}>{labels.title}</h2>
			<p className={classes.sectionLead}>{labels.lead}</p>

			<form onSubmit={form.onSubmit((values) => save.mutate(values))}>
				<Stack gap="md">
					<TextInput
						{...form.getInputProps("name")}
						key={form.key("name")}
						label={t.auth.fields.name}
						autoComplete="name"
						maxLength={USER_NAME_MAX_LENGTH}
						required
					/>

					<Group>
						<Button type="submit" size="sm" loading={save.isPending}>
							{labels.submit}
						</Button>
					</Group>
				</Stack>
			</form>
		</section>
	);
}

function PasswordForm({ email }: { email: string }) {
	const { t } = useI18n();
	const labels = t.auth.profile.password;

	const form = useForm({
		mode: "uncontrolled",
		initialValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
		validate: {
			currentPassword: (value) =>
				value ? null : t.auth.validation.passwordRequired,
			newPassword: (value) =>
				value.length >= MIN_PASSWORD_LENGTH
					? null
					: t.auth.validation.passwordTooShort,
			confirmPassword: (value, values) =>
				value === values.newPassword
					? null
					: t.auth.validation.passwordMismatch,
		},
	});

	const change = useMutation({
		mutationFn: ({ currentPassword, newPassword }: typeof form.values) =>
			changePassword({ data: { currentPassword, newPassword } }).then(unwrap),
		onSuccess: () => {
			form.reset();
			notifySuccess(labels.success);
		},
		onError: (error) => {
			notifyError(
				resolveErrorMessage(
					error,
					{
						400: labels.incorrect,
						429: t.auth.tooManyRequests,
					},
					t.auth.genericError,
				),
			);
		},
	});

	return (
		<section className={classes.section}>
			<h2 className={classes.sectionTitle}>{labels.title}</h2>
			<p className={classes.sectionLead}>{labels.lead}</p>

			<form onSubmit={form.onSubmit((values) => change.mutate(values))}>
				<Stack gap="md">
					<input
						type="hidden"
						name="username"
						autoComplete="username"
						value={email}
						readOnly
					/>

					<PasswordInput
						{...form.getInputProps("currentPassword")}
						key={form.key("currentPassword")}
						label={t.auth.fields.currentPassword}
						autoComplete="current-password"
						required
					/>

					<PasswordInput
						{...form.getInputProps("newPassword")}
						key={form.key("newPassword")}
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

					<Group>
						<Button type="submit" size="sm" loading={change.isPending}>
							{labels.submit}
						</Button>
					</Group>
				</Stack>
			</form>
		</section>
	);
}
