import { Link } from "@tanstack/react-router";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";
import classes from "./layout.module.css";

/**
 * The public destinations of the site, shared with the mobile drawer: the
 * header row and the drawer list are two shapes of the same navigation.
 */
export function useSiteNavLinks() {
	const { t } = useI18n();

	return [
		{ to: ROUTES.briefs, label: t.briefs.nav },
		{ to: ROUTES.howItWorks, label: t.nav.howItWorks },
	];
}

export function HeaderNav() {
	const { t } = useI18n();
	const links = useSiteNavLinks();

	return (
		<nav className={classes.nav} aria-label={t.a11y.mainNavigation}>
			{links.map((link) => (
				<Link key={link.to} to={link.to} className={classes.navLink}>
					{link.label}
				</Link>
			))}
		</nav>
	);
}
