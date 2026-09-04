import { toAudioFilename } from "@brief/services";
import { createFileRoute } from "@tanstack/react-router";
import { getContainer } from "#/libs/server/container";
import { withRequestLogger } from "#/libs/server/logger";

const notFound = () => new Response("Not found", { status: 404 });

/**
 * Streams the audio of a published brief. The bytes go through the app rather
 * than through a pre-signed S3 URL because the object storage is not reachable
 * from a browser — and would not be, without exposing the whole bucket.
 */
export const Route = createFileRoute("/api/briefs/audio/$fileId")({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				withRequestLogger(
					{ route: new URL(request.url).pathname },
					async () => {
						const container = getContainer();

						const audio = await container.briefsService.findPublishedAudio(
							params.fileId,
						);

						if (!audio) return notFound();

						// Forwarded to S3 as-is, so a browser seeking in the track pulls one
						// slice instead of the whole file. Without this an <audio> element
						// cannot seek at all in Safari, which refuses a source that does not
						// answer 206.
						const range = request.headers.get("range") ?? undefined;

						let file: Awaited<
							ReturnType<typeof container.s3Service.getFile>
						> | null = null;

						try {
							file = await container.s3Service.getFile(params.fileId, range);
						} catch {
							// The row exists but the object is gone from the bucket: to a
							// caller that is the same thing as an unknown file.
							return notFound();
						}

						const download = new URL(request.url).searchParams.has("download");
						const filename = toAudioFilename(
							audio.categoryName,
							audio.targetDate,
						);

						const headers = new Headers({
							"Content-Type": audio.mimeType,
							"Accept-Ranges": "bytes",
							"Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
							// A replay can rewrite the audio behind this id, so the copy is
							// cacheable but not immutable.
							"Cache-Control": "public, max-age=3600",
						});

						if (file.contentLength !== null) {
							headers.set("Content-Length", String(file.contentLength));
						}

						if (file.contentRange) {
							headers.set("Content-Range", file.contentRange);
						}

						return new Response(file.body, {
							status: file.contentRange ? 206 : 200,
							headers,
						});
					},
				),
		},
	},
});
