import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "#/components/admin/admin-shell";
import { ROUTES } from "#/config/routes";
import { requireAdmin } from "#/libs/auth/guards";
import { localeLoader, localisedHead } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/admin")({
	loader: localeLoader,
	head: localisedHead((t) => ({
		title: t.auth.admin.title,
		path: ROUTES.admin,
		noindex: true,
	})),
	// Written once here: every admin page inherits the guard from the layout.
	// It decides what gets rendered — the server functions carry their own
	// `adminMiddleware`.
	beforeLoad: ({ context, location }) =>
		requireAdmin({ queryClient: context.queryClient, href: location.href }),
	component: AdminLayout,
});

function AdminLayout() {
	return (
		<AdminShell>
			<Outlet />
		</AdminShell>
	);
}
