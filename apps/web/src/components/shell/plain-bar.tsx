import { ColorSchemeToggle } from "#/components/layout/color-scheme-toggle";
import { LanguageMenu } from "#/components/layout/language-menu";
import { Wordmark } from "#/components/layout/wordmark";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";
import classes from "./shell.module.css";

export function PlainBar({ children }: { children?: React.ReactNode }) {
	const { t } = useI18n();

	return (
		<header className={`brief-shell ${classes.bar}`}>
			<a
				href={ROUTES.landing}
				className={classes.wordmarkLink}
				aria-label={t.a11y.homeLink}
			>
				<Wordmark />
			</a>

			<div className={classes.barActions}>
				{children}
				<ColorSchemeToggle />
				<LanguageMenu />
			</div>
		</header>
	);
}
