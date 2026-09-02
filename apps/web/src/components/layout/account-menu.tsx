import { Menu } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SignOutIcon } from "#/components/icons";
import { sessionQueryOptions } from "#/libs/api/auth";
import { useI18n } from "#/libs/i18n/context";
import {
	ACCOUNT_ICON_SIZE,
	useAccountLinks,
	useSignOut,
} from "./account-links";
import classes from "./layout.module.css";

const initial = (name: string, email: string) =>
	(name.trim() || email).charAt(0).toLocaleUpperCase();

export function AccountMenu() {
	const { t } = useI18n();
	const { data: session } = useQuery(sessionQueryOptions());
	const links = useAccountLinks();
	const signOutMutation = useSignOut();
	const user = session?.user;

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

				{links.map((link) => (
					<Menu.Item
						key={link.to}
						component={Link}
						to={link.to}
						leftSection={link.icon}
					>
						{link.label}
					</Menu.Item>
				))}

				<Menu.Divider />

				<Menu.Item
					leftSection={<SignOutIcon size={ACCOUNT_ICON_SIZE} />}
					disabled={signOutMutation.isPending}
					onClick={() => signOutMutation.mutate()}
				>
					{labels.signOut}
				</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	);
}
