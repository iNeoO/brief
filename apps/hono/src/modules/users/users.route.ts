import {
	openApi404NotFound,
	openApi409Conflict,
	openApiResponse,
	openApiResponses,
} from "@brief/infra/helpers";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { userSchema } from "./users.schema.js";

export const GetUsersRoute = describeRoute({
	description: "Get all users",
	tags: ["users"],
	responses: {
		...openApiResponses(z.array(userSchema), 200, "List of users"),
	},
});

export const GetUserRoute = describeRoute({
	description: "Get a user by id",
	tags: ["users"],
	responses: {
		...openApiResponse(userSchema, 200, "User"),
		...openApi404NotFound("User not found"),
	},
});

export const CreateUserRoute = describeRoute({
	description: "Create a user",
	tags: ["users"],
	responses: {
		...openApiResponse(userSchema, 201, "Created user"),
		...openApi409Conflict("Email already in use"),
	},
});

export const UpdateUserRoute = describeRoute({
	description: "Update a user",
	tags: ["users"],
	responses: {
		...openApiResponse(userSchema, 200, "Updated user"),
		...openApi404NotFound("User not found"),
	},
});

export const DeleteUserRoute = describeRoute({
	description: "Delete a user",
	tags: ["users"],
	responses: {
		...openApiResponse(userSchema, 200, "Deleted user"),
		...openApi404NotFound("User not found"),
	},
});
