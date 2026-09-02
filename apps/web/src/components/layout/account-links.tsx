import { USER_ROLE } from "@brief/common/constants";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	ListIcon,
	NewspaperIcon,
	ShieldIcon,
	UserIcon,
} from "#/components/icons";
import { ROUTES } from "#/config/routes";
import { sessionQueryOptions, signOut } from "#/libs/api/auth";
import { useI18n } from "#/libs/i18n/context";
import { notifyError } from "#/libs/notify";

export const ACCOUNT_ICON_SIZE = 16;

/**
 * Where a signed-in reader can go, in one list: the header dropdown and the
 * mobile drawer are two renderings of it, not two lists that have to be kept
 * in step. Empty when nobody is signed in, so a caller can render it blind.
 */
export function useAccountLinks() {
	const { t } = useI18n();
	const { data: session } = useQuery(sessionQueryOptions());
	const user = session?.user;

	if (!user) {
		return [];
	}

	const links = [
		{
			to: ROUTES.home,
			label: t.nav.myBriefs,
			icon: <NewspaperIcon size={ACCOUNT_ICON_SIZE} />,
		},
		{
			to: ROUTES.topics,
			label: t.nav.myTopics,
			icon: <ListIcon size={ACCOUNT_ICON_SIZE} />,
		},
		{
			to: ROUTES.profile,
			label: t.nav.account.profile,
			icon: <UserIcon size={ACCOUNT_ICON_SIZE} />,
		},
	];

	if (user.role !== USER_ROLE.ADMIN) {
		return links;
	}

	return [
		...links,
		{
			to: ROUTES.admin,
			label: t.nav.account.admin,
			icon: <ShieldIcon size={ACCOUNT_ICON_SIZE} />,
		},
	];
}

/**
 * Signing out has to land the reader somewhere they are still allowed to be,
 * and only then drop the cache: resetting first would refetch the queries of
 * the page they are leaving as an anonymous visitor.
 */
export function useSignOut() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => signOut(),
		onSuccess: async () => {
			await navigate({ to: ROUTES.landing });

			await queryClient.resetQueries();
		},
		onError: () => notifyError(t.auth.genericError),
	});
}
