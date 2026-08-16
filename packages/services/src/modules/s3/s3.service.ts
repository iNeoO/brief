import {
	DeleteObjectCommand,
	GetObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { type Database, desc, schema } from "@brief/drizzle";
import { InternalError } from "@brief/infra/errors";
import { getLoggerStore } from "@brief/infra/libs";
import { buildFilename, buildObjectKey, countedBody } from "./s3.helper.js";
import type {
	FileRow,
	FileTarget,
	S3ServiceConfig,
	UploadFileParams,
} from "./s3.type.js";

export class S3Service {
	private client: S3Client;
	private bucket: string;

	constructor(
		private db: Database,
		config: S3ServiceConfig,
	) {
		this.bucket = config.bucket;
		this.client = new S3Client({
			endpoint: config.endpoint,
			region: config.region,
			credentials: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
			},
			// Garage serves buckets by path (host/bucket/key), not by subdomain
			forcePathStyle: true,
		});
	}

	async uploadFile({
		categoryJobId,
		kind,
		language,
		body,
		mimeType,
	}: UploadFileParams) {
		const filename = buildFilename({ categoryJobId, language, mimeType });
		const objectKey = buildObjectKey({
			categoryJobId,
			kind,
			language,
			mimeType,
		});
		const counted = countedBody(body);

		const previous = await this.db.query.files.findFirst({
			columns: { bucket: true, objectKey: true },
			where: { categoryJobId, kind, language },
		});

		try {
			// Multipart upload: the body is streamed through, one part at a time,
			// so an oversized file never lands in the worker's memory.
			await new Upload({
				client: this.client,
				params: {
					Bucket: this.bucket,
					Key: objectKey,
					Body: counted.stream,
					ContentType: mimeType,
				},
			}).done();
		} catch (err) {
			getLoggerStore().error({ err, objectKey }, "Failed to upload file to S3");
			if (err instanceof InternalError) throw err;
			throw new InternalError({
				code: "FILE_UPLOAD_FAILED",
				message: `Failed to upload file "${objectKey}" to S3`,
			});
		}

		// Only the consumed stream knows how many bytes actually went through.
		const size = counted.size();
		if (size === 0) {
			await this.deleteObject(this.bucket, objectKey);
			throw new InternalError({
				code: "FILE_UPLOAD_FAILED",
				message: `Refusing to record the empty file "${objectKey}"`,
			});
		}

		const values = {
			bucket: this.bucket,
			objectKey,
			mimeType,
			size,
			filename,
		};

		let row: FileRow | undefined;
		try {
			[row] = await this.db
				.insert(schema.files)
				.values({ categoryJobId, kind, language, ...values })
				.onConflictDoUpdate({
					target: [
						schema.files.categoryJobId,
						schema.files.kind,
						schema.files.language,
					],
					// $onUpdate only runs on update statements, not on upserts
					set: { ...values, updatedAt: new Date() },
				})
				.returning();
		} catch (err) {
			getLoggerStore().error({ err, objectKey }, "Failed to record file row");
			await this.deleteObject(this.bucket, objectKey);
			throw new InternalError({
				code: "FILE_UPLOAD_FAILED",
				message: `Failed to record file row for "${objectKey}"`,
			});
		}

		if (!row) {
			await this.deleteObject(this.bucket, objectKey);
			throw new InternalError({
				code: "FILE_UPLOAD_FAILED",
				message: `Failed to record file row for "${objectKey}"`,
			});
		}

		if (previous && previous.objectKey !== objectKey) {
			await this.deleteObject(previous.bucket, previous.objectKey);
		}

		return row;
	}

	async getFile(id: string) {
		const row = await this.db.query.files.findFirst({ where: { id } });
		if (!row) {
			throw new InternalError({
				code: "FILE_NOT_FOUND",
				message: `No file with id "${id}"`,
			});
		}

		try {
			const object = await this.client.send(
				new GetObjectCommand({ Bucket: row.bucket, Key: row.objectKey }),
			);
			if (!object.Body) {
				getLoggerStore().error(
					{ id, objectKey: row.objectKey },
					"S3 object has no body",
				);
				throw new InternalError({
					code: "FILE_DOWNLOAD_FAILED",
					message: `S3 object "${row.objectKey}" has no body`,
				});
			}
			return { file: row, body: object.Body.transformToWebStream() };
		} catch (err) {
			if (err instanceof InternalError) throw err;
			getLoggerStore().error(
				{ err, id, objectKey: row.objectKey },
				"Failed to get file from S3",
			);
			throw new InternalError({
				code: "FILE_DOWNLOAD_FAILED",
				message: `Failed to get file "${row.objectKey}" from S3`,
			});
		}
	}

	getFileByCategoryJob({ categoryJobId, kind, language }: FileTarget) {
		return this.db.query.files.findFirst({
			where: { categoryJobId, kind, language },
		});
	}

	getFiles() {
		return this.db
			.select()
			.from(schema.files)
			.orderBy(desc(schema.files.createdAt));
	}

	/**
	 * Best effort, and deliberately so: this runs after the rows referencing
	 * these objects are already gone, so a failure leaves an orphan in the
	 * bucket rather than an inconsistent database. Never throws — each failure
	 * is logged individually.
	 */
	async deleteObjects(targets: Array<{ bucket: string; objectKey: string }>) {
		await Promise.all(
			targets.map(({ bucket, objectKey }) =>
				this.deleteObject(bucket, objectKey),
			),
		);
	}

	private async deleteObject(bucket: string, objectKey: string) {
		try {
			await this.client.send(
				new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }),
			);
		} catch (err) {
			getLoggerStore().error(
				{ err, bucket, objectKey },
				"Failed to delete orphaned S3 object",
			);
		}
	}
}
