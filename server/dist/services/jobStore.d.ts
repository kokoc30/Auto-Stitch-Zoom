/**
 * Represents the current status of a processing job.
 * Streamed to the client via SSE for real-time progress updates.
 */
export type JobStatus = {
    jobId: string;
    status: 'validating' | 'resolving' | 'processing' | 'concatenating' | 'done' | 'error';
    currentStep: string;
    clipIndex: number;
    totalClips: number;
    progress: number;
    error?: string | undefined;
};
/**
 * In-memory job status store with EventEmitter-based subscription
 * for real-time SSE streaming to clients.
 */
declare class JobStore {
    private jobs;
    private emitter;
    constructor();
    updateJob(jobId: string, update: Partial<Omit<JobStatus, 'jobId'>>): void;
    getJob(jobId: string): JobStatus | undefined;
    subscribe(jobId: string, listener: (status: JobStatus) => void): () => void;
    removeJob(jobId: string): void;
}
export declare const jobStore: JobStore;
export {};
//# sourceMappingURL=jobStore.d.ts.map