import { z } from "zod";

export const postSchema = z.object({
	id: z.number(),
	title: z.string(),
	content: z.string().nullable(),
	authorId: z.number(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

export const createPostSchema = z.object({
	title: z.string(),
	content: z.string().optional(),
	authorId: z.number(),
});

export const updatePostSchema = z.object({
	title: z.string().optional(),
	content: z.string().optional(),
});

export const postIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export const postUserIdParamSchema = z.object({
	userId: z.coerce.number().int().positive(),
});
