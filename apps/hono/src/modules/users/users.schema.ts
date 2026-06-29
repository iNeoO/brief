import { z } from "zod";

export const userSchema = z.object({
	id: z.number(),
	email: z.email(),
	username: z.string().nullable(),
	name: z.string().nullable(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

export const createUserSchema = z.object({
	email: z.email(),
	username: z.string().optional(),
	name: z.string().optional(),
});

export const updateUserSchema = z.object({
	username: z.string().optional(),
	name: z.string().optional(),
});

export const userIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});
