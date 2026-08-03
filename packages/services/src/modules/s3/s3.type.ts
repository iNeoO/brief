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

/** Accepted upload contents. A stream carries no name, no type and no size. */
export type FileBody = Readable | ReadableStream<Uint8Array>;

/** Identifies the single file a job holds for a given kind and language. */
export type FileTarget = {
	categoryJobId: number;
	kind: FileKind;
	language: Language;
};

export type UploadFileParams = FileTarget & {
	body: FileBody;
	/** Content type of the body: the caller owns it, it cannot be sniffed. */
	mimeType: MimeType;
};
