import { Button } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { ROUTES } from "#/config/routes";
import { sessionQueryOptions } from "#/libs/api/auth";
import { useI18n } from "#/libs/i18n/context";
import { ColorSchemeToggle } from "./color-scheme-toggle";
import { LanguageMenu } from "./language-menu";
import classes from "./layout.module.css";
import { Wordmark } from "./wordmark";

export function SiteHeader() {
	const { t } = useI18n();
	// The root loader put the session in the cache, so this reads it rather than
	// fetching it: the header must be right on the first paint, or its links
	// would shift under the cursor once the answer arrives.
	const { data: session } = useQuery(sessionQueryOptions());
	const isSignedIn = Boolean(session?.user);

	return (
		<header className={classes.header}>
			<div className={`brief-shell ${classes.headerInner}`}>
				<a
					href="/"
					className={classes.wordmarkLink}
					aria-label={t.a11y.homeLink}
				>
					<Wordmark />
				</a>

				<nav className={classes.nav} aria-label={t.a11y.mainNavigation}>
					<a href={ROUTES.briefs} className={classes.navLink}>
						{t.briefs.nav}
					</a>

					{/* Signed in, the topics are a page to manage; anonymous, they are
					    the landing section that lists what we cover. */}
					{isSignedIn ? (
						<a href={ROUTES.topics} className={classes.navLink}>
							{t.nav.myTopics}
						</a>
					) : (
						<a href="#topics" className={classes.navLink}>
							{t.nav.topics}
						</a>
					)}

					<a href="#how-it-works" className={classes.navLink}>
						{t.nav.howItWorks}
					</a>
				</nav>

				<div className={classes.actions}>
					{isSignedIn ? (
						<Button
							component="a"
							href={ROUTES.home}
							size="sm"
							radius="sm"
							variant="default"
						>
							{t.nav.myBriefs}
						</Button>
					) : (
						<>
							<a href={ROUTES.signIn} className={classes.signIn}>
								{t.nav.signIn}
							</a>

							<Button component="a" href={ROUTES.signUp} size="sm" radius="sm">
								{t.nav.signUp}
							</Button>
						</>
					)}

					<span className={classes.actionsSeparator} aria-hidden="true" />

					<ColorSchemeToggle />
					<LanguageMenu />
				</div>
			</div>
		</header>
	);
}
