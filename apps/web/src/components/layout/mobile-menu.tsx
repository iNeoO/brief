import { SIGNUP_ENABLED } from "@brief/common/constants";
import { Burger, Button, Drawer } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CheckIcon, SignOutIcon } from "#/components/icons";
import { ROUTES } from "#/config/routes";
import { sessionQueryOptions } from "#/libs/api/auth";
import { LOCALE_LABELS, LOCALES } from "#/libs/i18n/config";
import { useI18n } from "#/libs/i18n/context";
import {
	ACCOUNT_ICON_SIZE,
	useAccountLinks,
	useSignOut,
} from "./account-links";
import { ColorSchemeToggle } from "./color-scheme-toggle";
import { useSiteNavLinks } from "./header-nav";
import classes from "./layout.module.css";

/** The width the header row lays its navigation out at, from the stylesheet. */
const DESKTOP_QUERY = "(min-width: 48em)";

/**
 * Everything the header row cannot fit on a phone: the site navigation, the
 * account destinations, and the two preferences. One button, one panel — the
 * narrow header has no room for a second entry point, and a reader looking
 * for "sign in" should not have to guess which icon hides it.
 */
export function MobileMenu() {
	const { locale, setLocale, t } = useI18n();
	const [opened, { close, toggle }] = useDisclosure(false);
	const { data: session } = useQuery(sessionQueryOptions());
	const navLinks = useSiteNavLinks();
	const accountLinks = useAccountLinks();
	const signOutMutation = useSignOut();
	const isDesktop = useMediaQuery(DESKTOP_QUERY);
	const user = session?.user;

	// A tablet turned to landscape crosses the breakpoint with the drawer still
	// open, and the header row it duplicates is then on screen behind it.
	useEffect(() => {
		if (isDesktop) {
			close();
		}
	}, [isDesktop, close]);

	const signOutAndClose = () => {
		close();
		signOutMutation.mutate();
	};

	return (
		<>
			<Burger
				opened={opened}
				onClick={toggle}
				hiddenFrom="sm"
				size="sm"
				aria-label={t.nav.menu}
			/>

			<Drawer
				opened={opened}
				onClose={close}
				position="right"
				size="min(20rem, 86%)"
				padding="md"
				title={t.nav.menu}
			>
				{/* The panel *is* the navigation on this width — the header's own
				    row is display:none, so this one carries the landmark. Every
				    link closes it: tapping one has to reveal the page. */}
				<nav className={classes.drawerNav} aria-label={t.a11y.mainNavigation}>
					{navLinks.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className={classes.drawerLink}
							onClick={close}
						>
							{link.label}
						</Link>
					))}

					{user ? (
						<>
							<div className={classes.drawerIdentity}>
								<p className={classes.accountName}>{user.name || user.email}</p>
								<p className={classes.accountEmail}>{user.email}</p>
							</div>

							{accountLinks.map((link) => (
								<Link
									key={link.to}
									to={link.to}
									className={classes.drawerLink}
									onClick={close}
								>
									<span className={classes.drawerLinkIcon} aria-hidden="true">
										{link.icon}
									</span>
									{link.label}
								</Link>
							))}

							<button
								type="button"
								className={classes.drawerLink}
								disabled={signOutMutation.isPending}
								onClick={signOutAndClose}
							>
								<span className={classes.drawerLinkIcon} aria-hidden="true">
									<SignOutIcon size={ACCOUNT_ICON_SIZE} />
								</span>
								{t.nav.account.signOut}
							</button>
						</>
					) : (
						<div className={classes.drawerAuth}>
							<Button
								component={Link}
								to={ROUTES.signIn}
								variant={SIGNUP_ENABLED ? "default" : "filled"}
								radius="sm"
								onClick={close}
								fullWidth
							>
								{t.nav.signIn}
							</Button>

							{SIGNUP_ENABLED ? (
								<Button
									component={Link}
									to={ROUTES.signUp}
									radius="sm"
									onClick={close}
									fullWidth
								>
									{t.nav.signUp}
								</Button>
							) : null}
						</div>
					)}
				</nav>

				<div className={classes.drawerPrefs}>
					<ColorSchemeToggle />

					{/* The two languages laid out, rather than the header's dropdown:
					    each button already names itself, so the row needs no label. */}
					<div className={classes.drawerLocales}>
						{LOCALES.map((option) => (
							<button
								key={option}
								type="button"
								className={`${classes.drawerLocale}${option === locale ? ` ${classes.drawerLocaleActive}` : ""}`}
								// The tick, not a colour, is what marks the active language.
								aria-current={option === locale}
								onClick={() => setLocale(option)}
							>
								{option === locale ? <CheckIcon size={14} /> : null}
								{LOCALE_LABELS[option]}
							</button>
						))}
					</div>
				</div>
			</Drawer>
		</>
	);
}
