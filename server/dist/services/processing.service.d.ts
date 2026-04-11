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
    accelerationMode: 'gpu' | 'cpu';
    concatMode: 'copy' | 'reencode' | 'xfade';
    warning?: string | undefined;
};
export declare function processClips(jobId: string, request: ProcessingRequest): Promise<ProcessingResult>;
//# sourceMappingURL=processing.service.d.ts.map