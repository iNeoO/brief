import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminShell } from "#/components/admin/admin-shell";
import { requireAdmin } from "#/libs/auth/guards";
import { localeLoader, localisedTitle } from "#/libs/i18n/route-head";

export const Route = createFileRoute("/admin")({
	loader: localeLoader,
	head: localisedTitle((d) => d.auth.admin.title),
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
