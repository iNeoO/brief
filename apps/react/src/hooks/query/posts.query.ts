import { useQuery } from "@tanstack/react-query";
import { getPost, getPosts, getPostsByUser } from "../../libs/api/posts.api";

export const postsKeys = {
	all: ["posts"] as const,
	byUser: (userId: number) => ["posts", "user", userId] as const,
	detail: (id: number) => ["posts", id] as const,
};

export function usePosts() {
	return useQuery({ queryKey: postsKeys.all, queryFn: getPosts });
}

export function usePostsByUser(userId: number) {
	return useQuery({ queryKey: postsKeys.byUser(userId), queryFn: () => getPostsByUser(userId) });
}

export function usePost(id: number) {
	return useQuery({ queryKey: postsKeys.detail(id), queryFn: () => getPost(id) });
}
