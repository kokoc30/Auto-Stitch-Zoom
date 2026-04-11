import { type VideoAccelerationMode } from '../config/video-processing.config.js';
export type ProcessingAcceleration = 'gpu' | 'cpu';
export type AccelerationDecision = {
    requestedMode: VideoAccelerationMode;
    resolvedMode: ProcessingAcceleration;
    gpuAvailable: boolean;
    reason: string;
};
export declare const NVIDIA_GPU_HWACCEL = "cuda";
export declare const NVIDIA_GPU_VIDEO_ENCODER = "h264_nvenc";
export declare const NVIDIA_GPU_PRESET = "medium";
export declare const NVIDIA_GPU_TUNE = "hq";
export declare const NVIDIA_GPU_CQ = 18;
export declare function resolveProcessingAcceleration(): Promise<AccelerationDecision>;
//# sourceMappingURL=video-acceleration.service.d.ts.map