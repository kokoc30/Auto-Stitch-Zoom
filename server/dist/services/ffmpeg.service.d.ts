import { NVIDIA_GPU_VIDEO_ENCODER, type ProcessingAcceleration } from './video-acceleration.service.js';
export type NormalizationOptions = {
    inputPath: string;
    outputPath: string;
    outputWidth: number;
    outputHeight: number;
    zoomFactor: number;
    outputFrameRate: number;
    hasAudio: boolean;
    acceleration: ProcessingAcceleration;
};
export type NormalizationResult = {
    acceleration: ProcessingAcceleration;
    videoEncoder: string;
};
export type ConcatenationOptions = {
    clipPaths: string[];
    outputPath: string;
    concatListPath: string;
    acceleration: ProcessingAcceleration;
};
export type ConcatenationResult = {
    mode: 'copy' | 'reencode' | 'xfade';
    videoEncoder: 'copy' | 'libx264' | typeof NVIDIA_GPU_VIDEO_ENCODER;
};
export type TransitionMergeOptions = {
    clipPaths: string[];
    clipDurations: number[];
    transitionDurationSec: number;
    outputPath: string;
    acceleration: ProcessingAcceleration;
};
export type TransitionMergeResult = {
    videoEncoder: 'libx264' | typeof NVIDIA_GPU_VIDEO_ENCODER;
};
export declare function normalizeAndZoomClip(options: NormalizationOptions): Promise<NormalizationResult>;
export declare function concatenateClips(options: ConcatenationOptions): Promise<ConcatenationResult>;
export declare function mergeWithTransitions(options: TransitionMergeOptions): Promise<TransitionMergeResult>;
//# sourceMappingURL=ffmpeg.service.d.ts.map