import { Readable } from "node:stream";
import { buffer as collect } from "node:stream/consumers";
import { FILE_KIND, LANGUAGE, MIME_TYPE } from "@brief/common/constants";
import { InternalError } from "@brief/infra/errors";
import { describe, expect, it } from "vitest";
import { buildFilename, buildObjectKey, countedBody } from "./s3.helper.js";

const target = {
	categoryJobId: 42,
	kind: FILE_KIND.AUDIO_FILE,
	language: LANGUAGE.FR,
};

const webStream = (chunks: Uint8Array[]) =>
	new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk);
			controller.close();
		},
	});

describe("buildObjectKey", () => {
	it("namespaces the key by job, kind and language, with the mime extension", () => {
		expect(buildObjectKey({ ...target, mimeType: MIME_TYPE.MP3 })).toMatch(
			/^category-jobs\/42\/audio_file\/fr\/[0-9a-f-]{36}\.mp3$/,
		);
	});

	it("keeps re-runs of the same job on distinct keys", () => {
		const params = { ...target, mimeType: MIME_TYPE.MP3 };
		expect(buildObjectKey(params)).not.toBe(buildObjectKey(params));
	});
});

describe("buildFilename", () => {
	it("names the file after the job and language", () => {
		expect(
			buildFilename({
				categoryJobId: 42,
				language: LANGUAGE.FR,
				mimeType: MIME_TYPE.MP3,
			}),
		).toBe("42-fr.mp3");
	});
});

describe("countedBody", () => {
	it("streams a web stream through and tallies its bytes", async () => {
		const counted = countedBody(
			webStream([Buffer.from("au"), Buffer.from("dio")]),
		);

		expect(counted.size()).toBe(0);
		expect((await collect(counted.stream)).toString()).toBe("audio");
		expect(counted.size()).toBe(5);
	});

	it("streams a node stream through", async () => {
		const counted = countedBody(
			Readable.from([Buffer.from("au"), Buffer.from("dio")]),
		);

		expect((await collect(counted.stream)).toString()).toBe("audio");
		expect(counted.size()).toBe(5);
	});

	it("counts bytes, not characters", async () => {
		const counted = countedBody(
			Readable.from([new TextEncoder().encode("héllo")]),
		);

		await collect(counted.stream);
		expect(counted.size()).toBe(6);
	});

	it("fails the stream once it grows past the limit, and closes the source", async () => {
		const source = Readable.from([Buffer.from("audio")]);
		const counted = countedBody(source, 2);

		await expect(collect(counted.stream)).rejects.toThrow(InternalError);
		expect(source.destroyed).toBe(true);
	});

	it("surfaces a source failure to the consumer", async () => {
		const source = Readable.from(
			(async function* () {
				yield Buffer.from("au");
				throw new Error("boom");
			})(),
		);

		await expect(collect(countedBody(source).stream)).rejects.toThrow("boom");
	});
});
