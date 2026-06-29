import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
	component: () => (
		<div className="min-h-screen bg-gray-50">
			<nav className="bg-white border-b border-gray-200 px-6 py-4">
				<div className="max-w-5xl mx-auto flex gap-6">
					<Link
						to="/"
						className="text-gray-500 hover:text-gray-900 text-sm font-medium"
						activeProps={{ className: "text-gray-900 font-semibold" }}
						activeOptions={{ exact: true }}
					>
						Posts
					</Link>
					<Link
						to="/users"
						className="text-gray-500 hover:text-gray-900 text-sm font-medium"
						activeProps={{ className: "text-gray-900 font-semibold" }}
					>
						Users
					</Link>
				</div>
			</nav>
			<main className="max-w-5xl mx-auto px-6 py-8">
				<Outlet />
			</main>
		</div>
	),
});
