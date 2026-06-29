import { API_ERROR } from "@brief/common/constants";
import { appWithLogs } from "@brief/infra/factories";
import { apiError } from "@brief/infra/helpers";
import type { UsersService } from "@brief/services";
import { validator } from "hono-openapi";
import {
	CreateUserRoute,
	DeleteUserRoute,
	GetUserRoute,
	GetUsersRoute,
	UpdateUserRoute,
} from "./users.route.js";
import {
	createUserSchema,
	updateUserSchema,
	userIdParamSchema,
} from "./users.schema.js";

export const createUsersController = (usersService: UsersService) => {
	return appWithLogs
		.createApp()
		.get("/", GetUsersRoute, async (c) => {
			const users = await usersService.findUsers();
			return c.json({ data: users }, 200);
		})
		.get(
			"/:id",
			GetUserRoute,
			validator("param", userIdParamSchema),
			async (c) => {
				const { id } = c.req.valid("param");
				const user = await usersService.findUserById(id);
				if (!user) return apiError(c, "USER_NOT_FOUND");
				return c.json({ data: user }, 200);
			},
		)
		.post(
			"/",
			CreateUserRoute,
			validator("json", createUserSchema),
			async (c) => {
				const body = c.req.valid("json");
				const result = await usersService.createUser(body);
				if (result === API_ERROR.EMAIL_ALREADY_EXISTS)
					return apiError(c, "EMAIL_ALREADY_EXISTS");
				return c.json({ data: result }, 201);
			},
		)
		.patch(
			"/:id",
			UpdateUserRoute,
			validator("param", userIdParamSchema),
			validator("json", updateUserSchema),
			async (c) => {
				const { id } = c.req.valid("param");
				const body = c.req.valid("json");
				const result = await usersService.updateUser(id, body);
				if (result === API_ERROR.USER_NOT_FOUND)
					return apiError(c, "USER_NOT_FOUND");
				return c.json({ data: result }, 200);
			},
		)
		.delete(
			"/:id",
			DeleteUserRoute,
			validator("param", userIdParamSchema),
			async (c) => {
				const { id } = c.req.valid("param");
				const result = await usersService.deleteUser(id);
				if (result === API_ERROR.USER_NOT_FOUND)
					return apiError(c, "USER_NOT_FOUND");
				return c.json({ data: result }, 200);
			},
		);
};
