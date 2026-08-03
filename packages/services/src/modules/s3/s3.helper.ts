import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { MAX_FILE_SIZE_BYTES, MIME_TYPE } from "@brief/common/constants";
import type { MimeType } from "@brief/common/types";
import { InternalError } from "@brief/infra/errors";
import type { FileBody, FileTarget } from "./s3.type.js";

const EXTENSION_BY_MIME_TYPE: Record<MimeType, string> = {
	[MIME_TYPE.MP3]: ".mp3",
};

export const buildFilename = ({
	categoryJobId,
	language,
	mimeType,
}: Pick<FileTarget, "categoryJobId" | "language"> & { mimeType: MimeType }) =>
	`${categoryJobId}-${language}${EXTENSION_BY_MIME_TYPE[mimeType]}`;

export const buildObjectKey = ({
	categoryJobId,
	kind,
	language,
	mimeType,
}: FileTarget & { mimeType: MimeType }) =>
	`category-jobs/${categoryJobId}/${kind}/${language}/${randomUUID()}${EXTENSION_BY_MIME_TYPE[mimeType]}`;

const toNodeStream = (body: FileBody) =>
	body instanceof Readable
		? body
		: Readable.fromWeb(body as NodeReadableStream<Uint8Array>);

export const countedBody = (body: FileBody, maxBytes = MAX_FILE_SIZE_BYTES) => {
	const source = toNodeStream(body);
	let size = 0;

	const counter = new Transform({
		transform(chunk: Buffer, _encoding, callback) {
			size += chunk.byteLength;
			if (size > maxBytes) {
				callback(
					new InternalError({
						code: "FILE_TOO_LARGE",
						message: `File body exceeds the ${maxBytes} bytes limit`,
					}),
				);
				return;
			}
			callback(null, chunk);
		},
	});

	source.on("error", (err) => counter.destroy(err));
	counter.on("error", () => source.destroy());
	source.pipe(counter);

	return { stream: counter, size: () => size };
};
