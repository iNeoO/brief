import { USER_ROLE } from "@brief/common/constants";
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { ROUTES } from "#/config/routes";
import { sessionQueryOptions } from "#/libs/api/auth";

type GuardArgs = {
	queryClient: QueryClient;
	href: string;
};

export const requireUser = async ({ queryClient, href }: GuardArgs) => {
	const session = await queryClient.ensureQueryData(sessionQueryOptions());

	if (!session?.user) {
		throw redirect({ to: ROUTES.signIn, search: { redirect: href } });
	}

	return session.user;
};

export const requireAdmin = async (args: GuardArgs) => {
	const user = await requireUser(args);

	if (user.role !== USER_ROLE.ADMIN) {
		throw redirect({ to: ROUTES.home });
	}

	return user;
};

export const redirectIfAuthenticated = async ({
	queryClient,
	to,
}: {
	queryClient: QueryClient;
	to: string;
}) => {
	const session = await queryClient.ensureQueryData(sessionQueryOptions());

	if (session?.user) {
		throw redirect({ href: to });
	}
};
