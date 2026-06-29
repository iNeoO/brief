import { toApiError } from "../apiError";
import { client } from "../hc";

export async function getPosts() {
	const res = await client.posts.$get();
	if (!res.ok) throw await toApiError(res, "Failed to fetch posts");
	return res.json();
}

export async function getPostsByUser(userId: number) {
	const res = await client.posts.user[":userId"].$get({
		param: { userId: String(userId) },
	});
	if (!res.ok) throw await toApiError(res, "Failed to fetch posts by user");
	return res.json();
}

export async function getPost(id: number) {
	const res = await client.posts[":id"].$get({ param: { id: String(id) } });
	if (!res.ok) throw await toApiError(res, "Failed to fetch post");
	return res.json();
}

export async function createPost(body: {
	title: string;
	authorId: number;
	content?: string;
}) {
	const res = await client.posts.$post({ json: body });
	if (!res.ok) throw await toApiError(res, "Failed to create post");
	return res.json();
}

export async function updatePost(
	id: number,
	body: { title?: string; content?: string },
) {
	const res = await client.posts[":id"].$patch({
		param: { id: String(id) },
		json: body,
	});
	if (!res.ok) throw await toApiError(res, "Failed to update post");
	return res.json();
}

export async function deletePost(id: number) {
	const res = await client.posts[":id"].$delete({ param: { id: String(id) } });
	if (!res.ok) throw await toApiError(res, "Failed to delete post");
	return res.json();
}
