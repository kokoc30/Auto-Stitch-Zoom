export type JobStatus = {
    jobId: string;
    status: 'validating' | 'resolving' | 'processing' | 'merging' | 'done' | 'error';
    currentStep: string;
    clipIndex: number;
    totalClips: number;
    progress: number;
    error?: string | undefined;
};
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