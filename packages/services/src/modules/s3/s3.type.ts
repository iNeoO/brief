import type { Readable } from "node:stream";
import type { FileKind, Language, MimeType } from "@brief/common/types";
import type { schema } from "@brief/drizzle";

export type S3ServiceConfig = {
	endpoint: string;
	region: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
};

export type FileRow = typeof schema.files.$inferSelect;

export type FileBody = Readable | ReadableStream<Uint8Array>;

export type FileTarget = {
	categoryJobId: number;
	kind: FileKind;
	language: Language;
};

export type UploadFileParams = FileTarget & {
	body: FileBody;
	mimeType: MimeType;
};
