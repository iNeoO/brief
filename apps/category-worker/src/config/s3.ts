import { z } from "zod";

const s3Schema = z.object({
	S3_ENDPOINT: z.string(),
	S3_PORT: z.coerce.number().int().positive(),
	S3_REGION: z.string(),
	S3_USE_SSL: z.stringbool().default(false),
	S3_ACCESS_KEY: z.string(),
	S3_SECRET_KEY: z.string(),
	S3_BUCKET: z.string(),
});

export const createS3Config = () => {
	const env = s3Schema.parse(process.env);

	return {
		endpoint: `${env.S3_USE_SSL ? "https" : "http"}://${env.S3_ENDPOINT}:${env.S3_PORT}`,
		region: env.S3_REGION,
		bucket: env.S3_BUCKET,
		accessKeyId: env.S3_ACCESS_KEY,
		secretAccessKey: env.S3_SECRET_KEY,
	};
};
