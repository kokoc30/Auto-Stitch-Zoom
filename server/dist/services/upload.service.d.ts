import type { VideoMetadata } from './metadata.service.js';
/**
 * Validates that a file has an allowed extension and MIME type.
 * Returns an error message string if invalid, or null if valid.
 */
export declare function validateFile(originalName: string, mimeType: string, fileSize?: number): string | null;
/**
 * Validates inspected video metadata after ffprobe runs.
 * Returns a clear user-facing error when the file appears corrupt,
 * unsupported, or the server cannot inspect media files.
 */
export declare function validateVideoMetadata(originalName: string, metadata: VideoMetadata): string | null;
//# sourceMappingURL=upload.service.d.ts.map