import { createFileRoute, redirect } from "@tanstack/react-router";
import { ROUTES } from "#/config/routes";

// `/admin/jobs` is the section, not a page: it opens on the first tab.
export const Route = createFileRoute("/admin/jobs/")({
	beforeLoad: () => {
		throw redirect({ to: ROUTES.adminJobsCategory });
	},
});
