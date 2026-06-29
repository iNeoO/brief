import {
	openApi404NotFound,
	openApiResponse,
	openApiResponses,
} from "@brief/infra/helpers";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { postSchema } from "./posts.schema.js";

export const GetPostsRoute = describeRoute({
	description: "Get all posts",
	tags: ["posts"],
	responses: {
		...openApiResponses(z.array(postSchema), 200, "List of posts"),
	},
});

export const GetPostsByUserRoute = describeRoute({
	description: "Get posts by user",
	tags: ["posts"],
	responses: {
		...openApiResponses(z.array(postSchema), 200, "List of posts by user"),
	},
});

export const GetPostRoute = describeRoute({
	description: "Get a post by id",
	tags: ["posts"],
	responses: {
		...openApiResponse(postSchema, 200, "Post"),
		...openApi404NotFound("Post not found"),
	},
});

export const CreatePostRoute = describeRoute({
	description: "Create a post",
	tags: ["posts"],
	responses: {
		...openApiResponse(postSchema, 201, "Created post"),
	},
});

export const UpdatePostRoute = describeRoute({
	description: "Update a post",
	tags: ["posts"],
	responses: {
		...openApiResponse(postSchema, 200, "Updated post"),
		...openApi404NotFound("Post not found"),
	},
});

export const DeletePostRoute = describeRoute({
	description: "Delete a post",
	tags: ["posts"],
	responses: {
		...openApiResponse(postSchema, 200, "Deleted post"),
		...openApi404NotFound("Post not found"),
	},
});
