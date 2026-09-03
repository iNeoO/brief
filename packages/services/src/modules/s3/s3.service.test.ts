import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { FILE_KIND, LANGUAGE, MIME_TYPE } from "@brief/common/constants";
import { desc, schema } from "@brief/drizzle";
import { InternalError } from "@brief/infra/errors";
import { type PinoLogger, wrapWithLogger } from "@brief/infra/libs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asDatabase, recordingChain } from "../../testing/db.fake.js";
import { S3Service } from "./s3.service.js";

const CATEGORY_JOB_ID = 101;
const OBJECT_KEY = "category-jobs/101/audio_file/fr/fixed-uuid.mp3";
const NOW = new Date("2026-08-17T06:30:00.000Z");

const send = vi.fn();
const uploadDone = vi.fn();
const buildObjectKey = vi.fn((_target: unknown) => OBJECT_KEY);

/**
 * The SDK is replaced wholesale: the commands become plain carriers of their
 * input, so a test can assert which object the service reached for, and the
 * multipart upload becomes a spy that still drains the body — the byte count
 * the service checks comes from the consumed stream.
 */
vi.mock("@aws-sdk/client-s3", () => ({
	S3Client: class {
		send(command: unknown) {
			return send(command);
		}
	},
	GetObjectCommand: class {
		constructor(public input: unknown) {}
	},
	DeleteObjectCommand: class {
		constructor(public input: unknown) {}
	},
}));

vi.mock("@aws-sdk/lib-storage", () => ({
	Upload: class {
		constructor(private options: { params: { Body: Readable } }) {}
		done() {
			return uploadDone(this.options);
		}
	},
}));

/** Only the object key is stubbed: it carries a uuid, and assertions need one. */
vi.mock("./s3.helper.js", async (importOriginal) => ({
	...(await importOriginal<typeof import("./s3.helper.js")>()),
	buildObjectKey: (target: unknown) => buildObjectKey(target),
}));

const config = {
	endpoint: "https://s3.example.test",
	region: "garage",
	bucket: "briefs",
	accessKeyId: "key",
	secretAccessKey: "secret",
	forcePathStyle: true,
};

const fileRow = {
	id: "file-1",
	categoryJobId: CATEGORY_JOB_ID,
	kind: FILE_KIND.AUDIO_FILE,
	language: LANGUAGE.FR,
	bucket: config.bucket,
	objectKey: OBJECT_KEY,
	mimeType: MIME_TYPE.MP3,
	size: 5,
	filename: "101-fr.mp3",
	createdAt: NOW,
	updatedAt: NOW,
};

type Rows = {
	/** What the relational query answers: the previous file, or the one to serve. */
	file?: Record<string, unknown>;
	/** What the upsert hands back; empty stands for a write that returned nothing. */
	inserted?: Record<string, unknown>[];
	/** Every file, for the admin list. */
	files?: Record<string, unknown>[];
};

const harness = (rows: Rows = {}) => {
	const findFirst = vi.fn().mockResolvedValue(rows.file);
	const insert = recordingChain(rows.inserted ?? [fileRow]);
	const select = recordingChain(rows.files ?? []);

	return {
		findFirst,
		insert,
		select,
		service: new S3Service(
			asDatabase({
				query: { files: { findFirst } },
				insert: (table: unknown) => insert.insert(table),
				select: () => select,
			}),
			config,
		),
	};
};

const errors = { error: vi.fn() };

/** The failure paths log through the async-local store, so the test provides one. */
const run = <T>(cb: () => Promise<T>) =>
	wrapWithLogger(errors as unknown as PinoLogger, cb);

const upload = (service: S3Service, body: Readable) =>
	run(() =>
		service.uploadFile({
			categoryJobId: CATEGORY_JOB_ID,
			kind: FILE_KIND.AUDIO_FILE,
			language: LANGUAGE.FR,
			body,
			mimeType: MIME_TYPE.MP3,
		}),
	);

const audio = () => Readable.from([Buffer.from("audio")]);

/** What a real multipart upload does to the body, and nothing else. */
const drainBody = async ({ params }: { params: { Body: Readable } }) => {
	for await (const _chunk of params.Body) {
		// consumed, like S3 would
	}
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(NOW);
	buildObjectKey.mockReturnValue(OBJECT_KEY);
	uploadDone.mockImplementation(drainBody);
	send.mockResolvedValue({});
});

describe("uploadFile", () => {
	it("streams the object up and records the row", async () => {
		const { service, insert } = harness();

		await expect(upload(service, audio())).resolves.toBe(fileRow);

		expect(uploadDone).toHaveBeenCalledOnce();
		expect(insert.args("values")).toEqual([
			{
				categoryJobId: CATEGORY_JOB_ID,
				kind: FILE_KIND.AUDIO_FILE,
				language: LANGUAGE.FR,
				bucket: config.bucket,
				objectKey: OBJECT_KEY,
				mimeType: MIME_TYPE.MP3,
				// Measured from the consumed stream, not announced by the caller.
				size: 5,
				filename: "101-fr.mp3",
			},
		]);
	});

	it("stamps the row itself on an upsert", async () => {
		// `$onUpdate` only runs on update statements, so an upsert would otherwise
		// keep the timestamp of the first upload for ever.
		const { service, insert } = harness();

		await upload(service, audio());

		expect(insert.args("onConflictDoUpdate")).toEqual([
			{
				target: [
					schema.files.categoryJobId,
					schema.files.kind,
					schema.files.language,
				],
				set: expect.objectContaining({ updatedAt: NOW }),
			},
		]);
	});

	it("purges the object it replaced", async () => {
		const previous = { bucket: "briefs", objectKey: "old/key.mp3" };
		const { service } = harness({ file: previous });

		await upload(service, audio());

		expect(send).toHaveBeenCalledOnce();
		const [command] = send.mock.calls[0] ?? [];
		expect(command).toBeInstanceOf(DeleteObjectCommand);
		expect(command.input).toEqual({
			Bucket: previous.bucket,
			Key: previous.objectKey,
		});
	});

	it("keeps the object when the upload landed on the same key", async () => {
		// Deleting it would remove the file the row now points at.
		const { service } = harness({
			file: { bucket: config.bucket, objectKey: OBJECT_KEY },
		});

		await upload(service, audio());

		expect(send).not.toHaveBeenCalled();
	});

	it("reports a failed upload as an internal error", async () => {
		const { service, insert } = harness();
		uploadDone.mockRejectedValue(new Error("connection reset"));

		await expect(upload(service, audio())).rejects.toMatchObject({
			code: "FILE_UPLOAD_FAILED",
		});

		expect(errors.error).toHaveBeenCalledOnce();
		// Nothing was stored, so nothing may be recorded.
		expect(insert.calls).toEqual([]);
	});

	it("keeps the reason when the upload already failed with one", async () => {
		// The body cap is enforced inside the stream, and its error is the useful
		// one — wrapping it would lose `FILE_TOO_LARGE`.
		const { service } = harness();
		uploadDone.mockRejectedValue(
			new InternalError({ code: "FILE_TOO_LARGE", message: "too big" }),
		);

		await expect(upload(service, audio())).rejects.toMatchObject({
			code: "FILE_TOO_LARGE",
		});
	});

	it("refuses to record an empty file, and takes the object back out", async () => {
		// A zero-byte audio row would be served as a playable file that plays
		// nothing.
		const { service, insert } = harness();

		await expect(upload(service, Readable.from([]))).rejects.toMatchObject({
			code: "FILE_UPLOAD_FAILED",
		});

		expect(insert.calls).toEqual([]);
		const [command] = send.mock.calls[0] ?? [];
		expect(command).toBeInstanceOf(DeleteObjectCommand);
		expect(command.input).toEqual({ Bucket: config.bucket, Key: OBJECT_KEY });
	});

	it("takes the object back out when the row cannot be written", async () => {
		const { service, insert } = harness();
		Object.assign(insert, {
			returning: () => Promise.reject(new Error("deadlock detected")),
		});

		await expect(upload(service, audio())).rejects.toMatchObject({
			code: "FILE_UPLOAD_FAILED",
		});

		expect(errors.error).toHaveBeenCalledOnce();
		expect(send.mock.calls[0]?.[0]).toBeInstanceOf(DeleteObjectCommand);
	});

	it("takes the object back out when the write returns no row", async () => {
		const { service } = harness({ inserted: [] });

		await expect(upload(service, audio())).rejects.toMatchObject({
			code: "FILE_UPLOAD_FAILED",
		});

		expect(send.mock.calls[0]?.[0]).toBeInstanceOf(DeleteObjectCommand);
	});
});

describe("getFile", () => {
	const body = { transformToWebStream: () => "web-stream" };

	it("serves the object with the row that describes it", async () => {
		const { service } = harness({ file: fileRow });
		send.mockResolvedValue({ Body: body, ContentLength: 5 });

		await expect(run(() => service.getFile("file-1"))).resolves.toEqual({
			file: fileRow,
			body: "web-stream",
			contentLength: 5,
			contentRange: null,
		});

		const [command] = send.mock.calls[0] ?? [];
		expect(command).toBeInstanceOf(GetObjectCommand);
		expect(command.input).toEqual({
			Bucket: fileRow.bucket,
			Key: fileRow.objectKey,
			Range: undefined,
		});
	});

	it("forwards a range so a browser can seek", async () => {
		// Verbatim: the caller is expected to answer 206 with what comes back.
		const { service } = harness({ file: fileRow });
		send.mockResolvedValue({
			Body: body,
			ContentLength: 2,
			ContentRange: "bytes 0-1/5",
		});

		await expect(
			run(() => service.getFile("file-1", "bytes=0-1")),
		).resolves.toMatchObject({ contentRange: "bytes 0-1/5" });

		expect(send.mock.calls[0]?.[0].input).toMatchObject({
			Range: "bytes=0-1",
		});
	});

	it("refuses an id no file carries", async () => {
		const { service } = harness({ file: undefined });

		await expect(run(() => service.getFile("ghost"))).rejects.toMatchObject({
			code: "FILE_NOT_FOUND",
		});
		expect(send).not.toHaveBeenCalled();
	});

	it("reports an object that came back without a body", async () => {
		const { service } = harness({ file: fileRow });
		send.mockResolvedValue({ Body: undefined });

		await expect(run(() => service.getFile("file-1"))).rejects.toMatchObject({
			code: "FILE_DOWNLOAD_FAILED",
		});
	});

	it("reports a refused download", async () => {
		const { service } = harness({ file: fileRow });
		send.mockRejectedValue(new Error("NoSuchKey"));

		await expect(run(() => service.getFile("file-1"))).rejects.toMatchObject({
			code: "FILE_DOWNLOAD_FAILED",
		});
		expect(errors.error).toHaveBeenCalledOnce();
	});
});

describe("getFileByCategoryJob", () => {
	it("finds the file of one job, kind and language", async () => {
		const { service, findFirst } = harness({ file: fileRow });

		await expect(
			service.getFileByCategoryJob({
				categoryJobId: CATEGORY_JOB_ID,
				kind: FILE_KIND.AUDIO_FILE,
				language: LANGUAGE.FR,
			}),
		).resolves.toBe(fileRow);

		expect(findFirst).toHaveBeenCalledWith({
			where: {
				categoryJobId: CATEGORY_JOB_ID,
				kind: FILE_KIND.AUDIO_FILE,
				language: LANGUAGE.FR,
			},
		});
	});
});

describe("getFiles", () => {
	it("lists every file, newest first", async () => {
		const { service, select } = harness({ files: [fileRow] });

		await expect(service.getFiles()).resolves.toEqual([fileRow]);

		expect(select.args("from")).toEqual([schema.files]);
		expect(select.args("orderBy")).toEqual([desc(schema.files.createdAt)]);
	});
});

describe("deleteObjects", () => {
	it("purges every target it was handed", async () => {
		const { service } = harness();

		await run(() =>
			service.deleteObjects([
				{ bucket: "briefs", objectKey: "a.mp3" },
				{ bucket: "briefs", objectKey: "b.mp3" },
			]),
		);

		expect(send).toHaveBeenCalledTimes(2);
	});

	it("does nothing when there is nothing to purge", async () => {
		const { service } = harness();

		await run(() => service.deleteObjects([]));

		expect(send).not.toHaveBeenCalled();
	});

	it("logs a failure rather than throw", async () => {
		// It runs after the rows are already gone: throwing would turn an orphan
		// in the bucket into a failed request.
		const { service } = harness();
		send.mockRejectedValue(new Error("AccessDenied"));

		await expect(
			run(() => service.deleteObjects([{ bucket: "briefs", objectKey: "a" }])),
		).resolves.toBeUndefined();

		expect(errors.error).toHaveBeenCalledOnce();
	});
});
