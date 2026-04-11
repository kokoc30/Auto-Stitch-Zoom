import { EventEmitter } from 'node:events';
// Small in-memory store for SSE progress updates.
class JobStore {
    jobs = new Map();
    emitter = new EventEmitter();
    constructor() {
        this.emitter.setMaxListeners(100);
    }
    updateJob(jobId, update) {
        const existing = this.jobs.get(jobId);
        const updated = {
            jobId,
            status: update.status ?? existing?.status ?? 'validating',
            currentStep: update.currentStep ?? existing?.currentStep ?? '',
            clipIndex: update.clipIndex ?? existing?.clipIndex ?? 0,
            totalClips: update.totalClips ?? existing?.totalClips ?? 0,
            progress: update.progress ?? existing?.progress ?? 0,
            error: update.error ?? existing?.error,
        };
        this.jobs.set(jobId, updated);
        this.emitter.emit(`job:${jobId}`, updated);
    }
    getJob(jobId) {
        return this.jobs.get(jobId);
    }
    subscribe(jobId, listener) {
        const event = `job:${jobId}`;
        this.emitter.on(event, listener);
        return () => {
            this.emitter.off(event, listener);
        };
    }
    removeJob(jobId) {
        this.jobs.delete(jobId);
        this.emitter.removeAllListeners(`job:${jobId}`);
    }
}
export const jobStore = new JobStore();
//# sourceMappingURL=jobStore.js.map