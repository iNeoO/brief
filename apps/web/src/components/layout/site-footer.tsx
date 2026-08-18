import { BRAND_NAME } from "@brief/common/constants";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";
import classes from "./layout.module.css";
import { Wordmark } from "./wordmark";

export function SiteFooter() {
	const { t } = useI18n();

	const links = [
		{ href: ROUTES.about, label: t.footer.about },
		{ href: ROUTES.legal, label: t.footer.legal },
		{ href: ROUTES.privacy, label: t.footer.privacy },
		{ href: ROUTES.contact, label: t.footer.contact },
	];

	return (
		<footer className={classes.footer}>
			<div className={`brief-shell ${classes.footerInner}`}>
				<Wordmark />

				<nav className={classes.footerLinks}>
					{links.map((link) => (
						<a key={link.href} href={link.href} className={classes.footerLink}>
							{link.label}
						</a>
					))}
				</nav>

				<p className={classes.footerRights}>
					{t.footer.rights(new Date().getFullYear(), BRAND_NAME)}
				</p>
			</div>
		</footer>
	);
}
