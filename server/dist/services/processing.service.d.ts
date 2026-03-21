import type { ProcessingOptions } from '../types/processing.types.js';
export type ProcessingRequest = {
    clipFilenames: string[];
    processingOptions: ProcessingOptions;
};
export type ProcessingResult = {
    jobId: string;
    outputFilename: string;
    outputPath: string;
    outputWidth: number;
    outputHeight: number;
    outputFrameRate: number;
    clipCount: number;
};
/**
 * Orchestrates the full video processing pipeline with step-level
 * progress reporting via the jobStore.
 *
 * Steps reported:
 *   validating -> resolving -> processing (per clip) -> concatenating -> done
 */
export declare function processClips(jobId: string, request: ProcessingRequest): Promise<ProcessingResult>;
//# sourceMappingURL=processing.service.d.ts.map