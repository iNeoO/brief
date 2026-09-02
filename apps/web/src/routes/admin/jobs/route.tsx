import { Tabs, Title } from "@mantine/core";
import {
	createFileRoute,
	Link,
	Outlet,
	useMatchRoute,
} from "@tanstack/react-router";
import classes from "#/components/admin/admin.module.css";
import { ROUTES } from "#/config/routes";
import { useI18n } from "#/libs/i18n/context";

/**
 * The two job lists share this heading and their tabs; each tab owns its own
 * search params, so switching tabs starts the other list at its defaults
 * rather than carrying a page number or a status that means nothing there.
 */
export const Route = createFileRoute("/admin/jobs")({
	component: AdminJobsLayout,
});

const TABS = [
	{ to: ROUTES.adminJobsCategory, key: "category" },
	{ to: ROUTES.adminJobsFetch, key: "fetch" },
] as const;

function AdminJobsLayout() {
	const { t } = useI18n();
	const labels = t.auth.admin.jobs;
	const matchRoute = useMatchRoute();

	const active =
		TABS.find((tab) => matchRoute({ to: tab.to, fuzzy: true }))?.to ??
		ROUTES.adminJobsCategory;

	return (
		<div className={classes.page}>
			<header>
				<Title order={1} size="h2" className={classes.heading}>
					{labels.title}
				</Title>
				<p className={classes.lead}>{labels.lead}</p>
			</header>

			<Tabs value={active} aria-label={labels.tabs.label}>
				<Tabs.List>
					{TABS.map((tab) => (
						<Tabs.Tab
							key={tab.to}
							value={tab.to}
							// `component={Link}` drops the router's own props from the
							// type; `renderRoot` keeps `to` checked against the route tree.
							renderRoot={(props) => <Link to={tab.to} {...props} />}
						>
							{labels.tabs[tab.key]}
						</Tabs.Tab>
					))}
				</Tabs.List>
			</Tabs>

			<Outlet />
		</div>
	);
}
