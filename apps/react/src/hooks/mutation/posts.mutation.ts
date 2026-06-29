import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPost, deletePost, updatePost } from "../../libs/api/posts.api";
import { postsKeys } from "../query/posts.query";

export function useCreatePost() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: createPost,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: postsKeys.all }),
	});
}

export function useUpdatePost() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...body }: { id: number; title?: string; content?: string }) =>
			updatePost(id, body),
		onSuccess: (_, { id }) => {
			queryClient.invalidateQueries({ queryKey: postsKeys.all });
			queryClient.invalidateQueries({ queryKey: postsKeys.detail(id) });
		},
	});
}

export function useDeletePost() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: deletePost,
		onSuccess: () => queryClient.invalidateQueries({ queryKey: postsKeys.all }),
	});
}
