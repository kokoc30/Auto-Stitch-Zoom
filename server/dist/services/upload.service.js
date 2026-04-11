import path from 'node:path';
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES } from '../config/upload.config.js';
const SUPPORTED_VIDEO_CODECS = ['h264', 'hevc', 'vp8', 'vp9', 'av1', 'mpeg4', 'prores'];
export function validateFile(originalName, mimeType, fileSize) {
    const ext = path.extname(originalName).toLowerCase();
    if (fileSize !== undefined && fileSize <= 0) {
        return `"${originalName}" is empty (0 bytes).`;
    }
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return `"${originalName}" has an unsupported file type (${ext}). Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    // Some browsers send odd MIME types, so the extension stays the main check.
    const allowedMimes = ALLOWED_MIME_TYPES;
    if (mimeType && !allowedMimes.includes(mimeType) && mimeType !== 'application/octet-stream') {
        return `"${originalName}" has an unexpected MIME type (${mimeType}). Allowed: .mp4, .mov, .webm`;
    }
    return null;
}
export function validateVideoMetadata(originalName, metadata) {
    if (metadata.inspectionError === 'ffprobe-unavailable') {
        return 'Video inspection is unavailable on the server. Install FFmpeg/ffprobe on PATH, or configure FFMPEG_BIN and FFPROBE_BIN, to validate and process uploads.';
    }
    if (metadata.inspectionError === 'invalid-media' ||
        !metadata.width ||
        !metadata.height ||
        metadata.duration === undefined ||
        metadata.duration <= 0) {
        return `"${originalName}" appears to be corrupt or is not a readable video file. Please export it again and re-upload it.`;
    }
    const codec = metadata.codec?.toLowerCase();
    if (codec && !SUPPORTED_VIDEO_CODECS.includes(codec)) {
        return `"${originalName}" uses an unsupported video codec (${codec}). Supported codecs for MVP are ${SUPPORTED_VIDEO_CODECS.join(', ')}.`;
    }
    return null;
}
//# sourceMappingURL=upload.service.js.map