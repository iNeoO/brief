import { useQuery } from "@tanstack/react-query";
import { getUser, getUsers } from "../../libs/api/users.api";

export const usersKeys = {
	all: ["users"] as const,
	detail: (id: number) => ["users", id] as const,
};

export function useUsers() {
	return useQuery({ queryKey: usersKeys.all, queryFn: getUsers });
}

export function useUser(id: number) {
	return useQuery({ queryKey: usersKeys.detail(id), queryFn: () => getUser(id) });
}
