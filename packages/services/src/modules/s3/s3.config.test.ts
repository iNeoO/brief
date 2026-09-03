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

	it("rejects an endpoint the SDK could not speak to", () => {
		// It parses as a URL, so only the protocol check stops it.
		expect(() =>
			createS3Config({ ...baseEnv, S3_ENDPOINT: "s3://garage-prod:3900" }),
		).toThrow(/http or https/);
	});

	it("trims the trailing slashes off an endpoint", () => {
		// The SDK builds `<endpoint>/<bucket>/<key>`, so a trailing slash would
		// address an object whose key starts with one.
		expect(
			createS3Config({ ...baseEnv, S3_ENDPOINT: "https://s3.example.test//" })
				.endpoint,
		).toBe("https://s3.example.test");
	});

	it("defaults to path-style addressing", () => {
		// Garage serves no virtual-host style, and that is what runs in production.
		expect(createS3Config(baseEnv).forcePathStyle).toBe(true);
	});
});
