import { AppShell, Burger, Group, NavLink, Stack } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { AccountMenu } from "#/components/layout/account-menu";
import { ColorSchemeToggle } from "#/components/layout/color-scheme-toggle";
import { HeaderNav } from "#/components/layout/header-nav";
import { LanguageMenu } from "#/components/layout/language-menu";
import { Wordmark } from "#/components/layout/wordmark";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";
import classes from "./admin.module.css";

export function AdminShell({ children }: { children: React.ReactNode }) {
	const { t } = useI18n();
	const [navbarOpened, { toggle: toggleNavbar, close: closeNavbar }] =
		useDisclosure(false);
	const matchRoute = useMatchRoute();

	const sections = [
		{
			to: ROUTES.adminCategories,
			label: t.auth.admin.nav.categories,
			active: Boolean(matchRoute({ to: ROUTES.adminCategories, fuzzy: true })),
		},
		{
			to: ROUTES.adminJobs,
			label: t.auth.admin.nav.jobs,
			active: Boolean(matchRoute({ to: ROUTES.adminJobs, fuzzy: true })),
		},
	];

	return (
		<AppShell
			header={{ height: 60 }}
			navbar={{
				width: 240,
				breakpoint: "sm",
				collapsed: { mobile: !navbarOpened },
			}}
			padding="md"
		>
			<AppShell.Header>
				<Group h="100%" px="md" justify="space-between" wrap="nowrap">
					<Group gap="sm" wrap="nowrap">
						<Burger
							opened={navbarOpened}
							onClick={toggleNavbar}
							hiddenFrom="sm"
							size="sm"
							aria-label={t.auth.admin.nav.toggle}
						/>

						<Link
							to={ROUTES.landing}
							className={classes.wordmarkLink}
							aria-label={t.a11y.homeLink}
						>
							<Wordmark />
						</Link>
					</Group>

					<HeaderNav />

					<Group gap="xs" wrap="nowrap">
						<AccountMenu />
						<ColorSchemeToggle />
						<LanguageMenu />
					</Group>
				</Group>
			</AppShell.Header>

			<AppShell.Navbar p="md">
				<Stack
					h="100%"
					justify="space-between"
					gap="md"
					component="nav"
					aria-label={t.auth.admin.nav.label}
				>
					<div>
						{sections.map((section) => (
							<NavLink
								key={section.to}
								component={Link}
								to={section.to}
								label={section.label}
								active={section.active}
								// Tapping a section on mobile should reveal the page, not
								// leave the drawer covering it.
								onClick={closeNavbar}
							/>
						))}
					</div>

					<NavLink
						component={Link}
						to={ROUTES.home}
						label={t.auth.admin.nav.backToBriefs}
						onClick={closeNavbar}
					/>
				</Stack>
			</AppShell.Navbar>

			<AppShell.Main>{children}</AppShell.Main>
		</AppShell>
	);
}
