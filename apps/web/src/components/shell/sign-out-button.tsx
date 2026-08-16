import { Button } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ROUTES } from "#/config/routes";
import { signOut } from "#/libs/api/auth";
import { useI18n } from "#/libs/i18n/context";
import { notifyError } from "#/libs/notify";

export function SignOutButton() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const signOutMutation = useMutation({
		mutationFn: () => signOut(),
		onSuccess: async () => {
			queryClient.clear();
			await navigate({ to: ROUTES.landing });
		},
		onError: () => notifyError(t.auth.genericError),
	});

	return (
		<Button
			variant="default"
			size="sm"
			loading={signOutMutation.isPending}
			onClick={() => signOutMutation.mutate()}
		>
			{t.auth.home.signOut}
		</Button>
	);
}
