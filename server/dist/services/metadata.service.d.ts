export type VideoMetadata = {
    duration?: number | undefined;
    width?: number | undefined;
    height?: number | undefined;
    codec?: string | undefined;
    frameRate?: number | undefined;
    hasAudio?: boolean | undefined;
    inspectionError?: 'ffprobe-unavailable' | 'invalid-media' | undefined;
};
export declare function extractMetadata(filePath: string): Promise<VideoMetadata>;
//# sourceMappingURL=metadata.service.d.ts.map