import { USER_ROLE } from "@brief/common/constants";
import { Menu } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	ListIcon,
	NewspaperIcon,
	ShieldIcon,
	SignOutIcon,
	UserIcon,
} from "#/components/icons";
import { ROUTES } from "#/config/routes";
import { sessionQueryOptions, signOut } from "#/libs/api/auth";
import { useI18n } from "#/libs/i18n/context";
import { notifyError } from "#/libs/notify";
import classes from "./layout.module.css";

const ICON_SIZE = 16;

const initial = (name: string, email: string) =>
	(name.trim() || email).charAt(0).toLocaleUpperCase();

export function AccountMenu() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: session } = useQuery(sessionQueryOptions());
	const user = session?.user;

	const signOutMutation = useMutation({
		mutationFn: () => signOut(),
		onSuccess: async () => {
			await navigate({ to: ROUTES.landing });

			await queryClient.resetQueries();
		},
		onError: () => notifyError(t.auth.genericError),
	});

	if (!user) {
		return null;
	}

	const labels = t.nav.account;
	const name = user.name || user.email;

	return (
		<Menu position="bottom-end" width={230} radius="sm" shadow="xs">
			<Menu.Target>
				<button
					type="button"
					className={classes.accountTrigger}
					aria-label={labels.trigger(name)}
				>
					<span className={classes.accountInitial} aria-hidden="true">
						{initial(user.name, user.email)}
					</span>
				</button>
			</Menu.Target>

			<Menu.Dropdown>
				<div className={classes.accountIdentity}>
					<p className={classes.accountName}>{name}</p>
					<p className={classes.accountEmail}>{user.email}</p>
				</div>

				<Menu.Divider />

				<Menu.Item
					component={Link}
					to={ROUTES.home}
					leftSection={<NewspaperIcon size={ICON_SIZE} />}
				>
					{t.nav.myBriefs}
				</Menu.Item>

				<Menu.Item
					component={Link}
					to={ROUTES.topics}
					leftSection={<ListIcon size={ICON_SIZE} />}
				>
					{t.nav.myTopics}
				</Menu.Item>

				<Menu.Item
					component={Link}
					to={ROUTES.profile}
					leftSection={<UserIcon size={ICON_SIZE} />}
				>
					{labels.profile}
				</Menu.Item>

				{user.role === USER_ROLE.ADMIN ? (
					<Menu.Item
						component={Link}
						to={ROUTES.admin}
						leftSection={<ShieldIcon size={ICON_SIZE} />}
					>
						{labels.admin}
					</Menu.Item>
				) : null}

				<Menu.Divider />

				<Menu.Item
					leftSection={<SignOutIcon size={ICON_SIZE} />}
					disabled={signOutMutation.isPending}
					onClick={() => signOutMutation.mutate()}
				>
					{labels.signOut}
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	);
}
