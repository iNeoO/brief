import { USER_ROLE } from "@brief/common/constants";
import { Anchor, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PlainBar } from "#/components/shell/plain-bar";
import classes from "#/components/shell/shell.module.css";
import { SignOutButton } from "#/components/shell/sign-out-button";
import { ROUTES } from "#/config/routes";
import { sessionQueryOptions } from "#/libs/api/auth";
import { requireUser } from "#/libs/auth/guards";
import { useI18n } from "#/libs/i18n/context";
import { localeLoader, localisedTitle } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/home")({
	loader: localeLoader,
	head: localisedTitle((d) => d.auth.home.title),
	beforeLoad: ({ context, location }) =>
		requireUser({ queryClient: context.queryClient, href: location.href }),
	component: HomePage,
});

function HomePage() {
	const { t } = useI18n();
	const { data: session } = useQuery(sessionQueryOptions());
	const user = session?.user;

	return (
		<div className={classes.page}>
			<PlainBar>
				<SignOutButton />
			</PlainBar>

			<main id="main" className={`brief-shell ${classes.appMain}`}>
				<Title order={1} className={classes.appHeading}>
					{t.auth.home.title}
				</Title>

				{user ? (
					<p className={classes.appMeta}>
						{t.auth.home.greeting(user.name || user.email)}
					</p>
				) : null}

				<p className={classes.appPlaceholder}>{t.auth.home.placeholder}</p>

				<div className={classes.appActions}>
					<Anchor component={Link} to={ROUTES.preferences} underline="always">
						{t.auth.home.manageTopics}
					</Anchor>

					{user?.role === USER_ROLE.ADMIN ? (
						<Anchor component={Link} to={ROUTES.admin} underline="always">
							{t.auth.home.adminArea}
						</Anchor>
					) : null}
				</div>
			</main>
		</div>
	);
}
