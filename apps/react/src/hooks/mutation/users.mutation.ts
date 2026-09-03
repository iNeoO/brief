import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createUser, deleteUser, updateUser } from "../../libs/api/users.api";
import { usersKeys } from "../query/users.query";

export function useCreateUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createUser,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
	});
}

export function useUpdateUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...body }: { id: number; username?: string; name?: string }) =>
			updateUser(id, body),
		onSuccess: (_, { id }) => {
			queryClient.invalidateQueries({ queryKey: usersKeys.all });
			queryClient.invalidateQueries({ queryKey: usersKeys.detail(id) });
		},
	});
}

export function useDeleteUser() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deleteUser,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKeys.all }),
	});
}
