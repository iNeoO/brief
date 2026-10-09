import { createHash, randomUUID } from "node:crypto";
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { afterAll, describe, expect, it } from "vitest";
import { createS3Config } from "./s3.config.js";
import { createS3Client } from "./s3.service.js";

const config = process.env.SMOKE ? createS3Config() : null;
const client = config ? createS3Client(config) : null;
const objectKey = `healthchecks/multipart-${randomUUID()}.bin`;

afterAll(() => client?.destroy());

describe.skipIf(!process.env.SMOKE)("S3 multipart round trip (network)", () => {
	it("uploads, reads and deletes an object larger than one multipart part", async () => {
		if (!client || !config) throw new Error("S3 smoke test is not configured");

		// The default multipart part is 5 MiB. Crossing it exercises Garage's
		// multipart checksum path instead of proving only that small objects work.
		const source = Buffer.alloc(6 * 1024 * 1024, 0xa5);
		const expectedHash = createHash("sha256").update(source).digest("hex");

		try {
			await new Upload({
				client,
				params: {
					Bucket: config.bucket,
					Key: objectKey,
					Body: source,
					ContentType: "application/octet-stream",
				},
			}).done();

			const head = await client.send(
				new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }),
			);
			expect(head.ContentLength).toBe(source.length);

			const object = await client.send(
				new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
			);
			if (!object.Body)
				throw new Error("Garage returned an object without a body");

			const downloaded = await object.Body.transformToByteArray();

			expect(downloaded.length).toBe(source.length);
			expect(createHash("sha256").update(downloaded).digest("hex")).toBe(
				expectedHash,
			);
		} finally {
			await client.send(
				new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey }),
			);
		}
	}, 30_000);
});
