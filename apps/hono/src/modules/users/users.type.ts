import type { ApiResponse } from "@brief/infra/types";
import type z from "zod";
import type { userSchema } from "./users.schema.js";

type UserDto = z.infer<typeof userSchema>;
export type UserApiResponse = ApiResponse<UserDto>;
export type UsersApiResponse = ApiResponse<UserDto[]>;
