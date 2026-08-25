import { Link } from "@tanstack/react-router";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";
import classes from "./layout.module.css";

export function HeaderNav() {
	const { t } = useI18n();

	return (
		<nav className={classes.nav} aria-label={t.a11y.mainNavigation}>
			<Link to={ROUTES.briefs} className={classes.navLink}>
				{t.briefs.nav}
			</Link>

			<Link to={ROUTES.howItWorks} className={classes.navLink}>
				{t.nav.howItWorks}
			</Link>
		</nav>
	);
}
