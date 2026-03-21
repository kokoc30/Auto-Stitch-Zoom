/**
 * Server-side clip types — mirrors the client-side ClipItem.
 * Properties use `| undefined` to satisfy exactOptionalPropertyTypes.
 */
import type { ClipEditSettings } from './processing.types.js';
export type ClipItem = {
    id: string;
    filename: string;
    originalName: string;
    duration?: number | undefined;
    width?: number | undefined;
    height?: number | undefined;
    mimeType?: string | undefined;
    thumbnailUrl?: string | undefined;
    fileSize?: number | undefined;
    edits?: ClipEditSettings | undefined;
};
export type UploadResponse = {
    success: boolean;
    clips: ClipItem[];
    errors?: string[] | undefined;
};
//# sourceMappingURL=clip.types.d.ts.map