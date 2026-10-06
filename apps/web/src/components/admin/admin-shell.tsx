import { AppShell, Burger, Group, NavLink, Stack, Text } from "@mantine/core";
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
		// Exact: every other section also lives under `/admin`.
		{ to: ROUTES.admin, label: t.auth.admin.nav.overview, exact: true },
		{
			to: ROUTES.adminCategories,
			label: t.auth.admin.nav.categories,
			exact: false,
		},
		{ to: ROUTES.adminJobs, label: t.auth.admin.nav.jobs, exact: false },
		{ to: ROUTES.adminUsers, label: t.auth.admin.nav.users, exact: false },
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
								active={Boolean(
									matchRoute({ to: section.to, fuzzy: !section.exact }),
								)}
								// Mantine also styles the Link's own `aria-current`, which is fuzzy by default.
								activeOptions={{ exact: section.exact, includeSearch: false }}
								// Tapping a section on mobile should reveal the page, not
								// leave the drawer covering it.
								onClick={closeNavbar}
							/>
						))}
					</div>

					<div>
						<NavLink
							component={Link}
							to={ROUTES.home}
							label={t.auth.admin.nav.backToBriefs}
							onClick={closeNavbar}
						/>

						{/* Which commit this deployment runs — see `define` in vite.config.ts. */}
						<Text size="xs" c="dimmed" px="sm" pt="xs">
							{t.auth.admin.nav.version(__BUILD_COMMIT__)}
						</Text>
					</div>
				</Stack>
			</AppShell.Navbar>

			<AppShell.Main>{children}</AppShell.Main>
		</AppShell>
	);
}
