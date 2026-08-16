import { Button } from "@mantine/core";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";
import { ColorSchemeToggle } from "./color-scheme-toggle";
import { LanguageMenu } from "./language-menu";
import classes from "./layout.module.css";
import { Wordmark } from "./wordmark";

export function SiteHeader() {
	const { t } = useI18n();

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
					<a href="#topics" className={classes.navLink}>
						{t.nav.topics}
					</a>
					<a href="#how-it-works" className={classes.navLink}>
						{t.nav.howItWorks}
					</a>
				</nav>

				<div className={classes.actions}>
					<a href={ROUTES.signIn} className={classes.signIn}>
						{t.nav.signIn}
					</a>

					<Button component="a" href={ROUTES.signUp} size="sm" radius="sm">
						{t.nav.signUp}
					</Button>

					<span className={classes.actionsSeparator} aria-hidden="true" />

					<ColorSchemeToggle />
					<LanguageMenu />
				</div>
			</div>
		</header>
	);
}
