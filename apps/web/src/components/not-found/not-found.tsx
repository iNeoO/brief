import { Button, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SiteShell } from "#/components/layout/site-shell";
import { ROUTES } from "#/config/routes";
import { sessionQueryOptions } from "#/libs/api/auth";
import { useI18n } from "#/libs/i18n/context";
import classes from "./not-found.module.css";

export function NotFound() {
	const { t } = useI18n();
	const { data: session } = useQuery(sessionQueryOptions());
	const isSignedIn = Boolean(session?.user);

	return (
		<SiteShell>
			<div className={`brief-shell ${classes.page}`}>
				<p className={classes.code} aria-hidden="true">
					404
				</p>

				<Title order={1} className={classes.title}>
					{t.notFound.title}
				</Title>

				<p className={classes.lead}>{t.notFound.lead}</p>

				<div className={classes.actions}>
					<Button
						component={Link}
						to={isSignedIn ? ROUTES.home : ROUTES.landing}
						size="md"
						radius="sm"
					>
						{isSignedIn ? t.nav.myBriefs : t.notFound.home}
					</Button>

					<Link to={ROUTES.briefs} className={classes.secondary}>
						{t.notFound.briefs}
					</Link>
				</div>
			</div>
		</SiteShell>
	);
}
