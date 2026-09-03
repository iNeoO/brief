import type { ApiResponse } from "@brief/infra/types";
import type z from "zod";
import type { postSchema } from "./posts.schema.js";

type PostDto = z.infer<typeof postSchema>;
export type PostApiResponse = ApiResponse<PostDto>;
export type PostsApiResponse = ApiResponse<PostDto[]>;
