/** Allowed video MIME types for upload validation */
export declare const ALLOWED_MIME_TYPES: readonly ["video/mp4", "video/quicktime", "video/webm"];
/** Allowed file extensions (lowercase, with dot) */
export declare const ALLOWED_EXTENSIONS: readonly [".mp4", ".mov", ".webm"];
/** Maximum file size per video: 500 MB */
export declare const MAX_FILE_SIZE: number;
/** Maximum number of files per single upload request */
export declare const MAX_FILES_PER_UPLOAD = 20;
/** Base directory for all upload storage */
export declare const UPLOAD_BASE_DIR: string;
//# sourceMappingURL=upload.config.d.ts.map