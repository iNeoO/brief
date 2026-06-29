import { toApiError } from "../apiError";
import { client } from "../hc";

export async function getUsers() {
	const res = await client.users.$get();
	if (!res.ok) throw await toApiError(res, "Failed to fetch users");
	return res.json();
}

export async function getUser(id: number) {
	const res = await client.users[":id"].$get({ param: { id: String(id) } });
	if (!res.ok) throw await toApiError(res, "Failed to fetch user");
	return res.json();
}

export async function createUser(body: {
	email: string;
	username?: string;
	name?: string;
}) {
	const res = await client.users.$post({ json: body });
	if (!res.ok) throw await toApiError(res, "Failed to create user");
	return res.json();
}

export async function updateUser(
	id: number,
	body: { username?: string; name?: string },
) {
	const res = await client.users[":id"].$patch({
		param: { id: String(id) },
		json: body,
	});
	if (!res.ok) throw await toApiError(res, "Failed to update user");
	return res.json();
}

export async function deleteUser(id: number) {
	const res = await client.users[":id"].$delete({ param: { id: String(id) } });
	if (!res.ok) throw await toApiError(res, "Failed to delete user");
	return res.json();
}
