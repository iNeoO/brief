import { createFileRoute, redirect } from "@tanstack/react-router";
import { ROUTES } from "#/config/routes";

// `/admin` has no dashboard of its own yet: it opens on the first section.
export const Route = createFileRoute("/admin/")({
	beforeLoad: () => {
		throw redirect({ to: ROUTES.adminCategories });
	},
});
