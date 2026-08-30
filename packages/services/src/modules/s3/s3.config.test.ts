import { describe, expect, it } from "vitest";
import { createS3Config } from "./s3.config.js";

const baseEnv = {
	S3_ENDPOINT: "http://garage-prod:3900",
	S3_REGION: "garage",
	S3_ACCESS_KEY: "access-key",
	S3_SECRET_KEY: "secret-key",
	S3_BUCKET: "brief-prod",
};

describe("createS3Config", () => {
	it("uses the infra S3 endpoint URL directly", () => {
		expect(createS3Config({ ...baseEnv, S3_FORCE_PATH_STYLE: "true" })).toEqual(
			{
				endpoint: "http://garage-prod:3900",
				region: "garage",
				bucket: "brief-prod",
				accessKeyId: "access-key",
				secretAccessKey: "secret-key",
				forcePathStyle: true,
			},
		);
	});

	it("accepts an already parsed boolean forcePathStyle value", () => {
		expect(
			createS3Config({ ...baseEnv, S3_FORCE_PATH_STYLE: false }).forcePathStyle,
		).toBe(false);
	});

	it("rejects legacy host-only endpoints", () => {
		expect(() =>
			createS3Config({ ...baseEnv, S3_ENDPOINT: "garage-prod" }),
		).toThrow();
	});
});
