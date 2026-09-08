import { z } from "zod";
import type { S3ServiceConfig } from "./s3.type.js";

/**
 * `new URL("https://host").toString()` hands back `https://host/`, and the SDK
 * builds its own paths onto the endpoint, so that slash has to come off.
 *
 * A walk back from the end rather than `replace(/\/+$/, "")`: an anchored `+`
 * makes the regex engine retry the run of slashes from every position it could
 * start at, which is quadratic in the length of the value — and the value comes
 * from the environment, so SonarQube raises the pattern as a slow-regex hotspot
 * (S5852). Scanning the tail is linear and reads the same.
 */
const stripTrailingSlashes = (value: string) => {
	let end = value.length;

	while (end > 0 && value.charAt(end - 1) === "/") end -= 1;

	return value.slice(0, end);
};

const endpointSchema = z
	.string()
	.min(1)
	.transform((endpoint, ctx) => {
		try {
			const url = new URL(endpoint);
			if (!["http:", "https:"].includes(url.protocol)) {
				ctx.addIssue({
					code: "custom",
					message: "S3_ENDPOINT must use http or https",
				});
				return z.NEVER;
			}

			return stripTrailingSlashes(url.toString());
		} catch {
			ctx.addIssue({
				code: "custom",
				message: "S3_ENDPOINT must be an absolute URL",
			});
			return z.NEVER;
		}
	});

export const s3EnvSchema = z.object({
	S3_ENDPOINT: endpointSchema,
	S3_REGION: z.string().min(1),
	S3_ACCESS_KEY: z.string().min(1),
	S3_SECRET_KEY: z.string().min(1),
	S3_BUCKET: z.string().min(1),
	S3_FORCE_PATH_STYLE: z.union([z.stringbool(), z.boolean()]).default(true),
});

export const createS3Config = (
	source: Record<string, unknown> = process.env,
): S3ServiceConfig => {
	const env = s3EnvSchema.parse(source);

	return {
		endpoint: env.S3_ENDPOINT,
		region: env.S3_REGION,
		bucket: env.S3_BUCKET,
		accessKeyId: env.S3_ACCESS_KEY,
		secretAccessKey: env.S3_SECRET_KEY,
		forcePathStyle: env.S3_FORCE_PATH_STYLE,
	};
};
