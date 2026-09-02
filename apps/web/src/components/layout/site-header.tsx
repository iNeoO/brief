import { SIGNUP_ENABLED } from "@brief/common/constants";
import { Button } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ROUTES } from "#/config/routes";
import { sessionQueryOptions } from "#/libs/api/auth";
import { useI18n } from "#/libs/i18n/context";
import { AccountMenu } from "./account-menu";
import { ColorSchemeToggle } from "./color-scheme-toggle";
import { HeaderNav } from "./header-nav";
import { LanguageMenu } from "./language-menu";
import classes from "./layout.module.css";
import { MobileMenu } from "./mobile-menu";
import { Wordmark } from "./wordmark";

export function SiteHeader() {
	const { t } = useI18n();
	const { data: session } = useQuery(sessionQueryOptions());
	const isSignedIn = Boolean(session?.user);

	return (
		<header className={classes.header}>
			<div className={`brief-shell ${classes.headerInner}`}>
				<Link
					to={ROUTES.landing}
					className={classes.wordmarkLink}
					aria-label={t.a11y.homeLink}
				>
					<Wordmark />
				</Link>

				<HeaderNav />

				<div className={classes.actions}>
					{/* Below the breakpoint these are all in the drawer instead: a
					    phone header that tries to hold them ends up holding none of
					    them, which is where this row started. */}
					<div className={classes.desktopActions}>
						{isSignedIn ? (
							<AccountMenu />
						) : (
							<>
								<Link
									to={ROUTES.signIn}
									search={{ redirect: undefined }}
									className={classes.signIn}
								>
									{t.nav.signIn}
								</Link>

								{SIGNUP_ENABLED ? (
									<Button
										component={Link}
										to={ROUTES.signUp}
										size="sm"
										radius="sm"
									>
										{t.nav.signUp}
									</Button>
								) : null}
							</>
						)}

						<span className={classes.actionsSeparator} aria-hidden="true" />

						<ColorSchemeToggle />
						<LanguageMenu />
					</div>

					<MobileMenu />
				</div>
			</div>
		</header>
	);
}
