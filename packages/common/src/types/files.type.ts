import type { FILE_KIND, MIME_TYPE } from "../constants/files.constant.js";

export type FileKind = (typeof FILE_KIND)[keyof typeof FILE_KIND];

export type MimeType = (typeof MIME_TYPE)[keyof typeof MIME_TYPE];
