import { EventEmitter } from 'node:events';

export type JobStatus = {
  jobId: string;
  status: 'validating' | 'resolving' | 'processing' | 'concatenating' | 'done' | 'error';
  currentStep: string;
  clipIndex: number;
  totalClips: number;
  progress: number;
  error?: string | undefined;
};

// Small in-memory store for SSE progress updates.
class JobStore {
  private jobs = new Map<string, JobStatus>();
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  updateJob(jobId: string, update: Partial<Omit<JobStatus, 'jobId'>>): void {
    const existing = this.jobs.get(jobId);
    const updated: JobStatus = {
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

  getJob(jobId: string): JobStatus | undefined {
    return this.jobs.get(jobId);
  }

  subscribe(jobId: string, listener: (status: JobStatus) => void): () => void {
    const event = `job:${jobId}`;
    this.emitter.on(event, listener);
    return () => {
      this.emitter.off(event, listener);
    };
  }

  removeJob(jobId: string): void {
    this.jobs.delete(jobId);
    this.emitter.removeAllListeners(`job:${jobId}`);
  }
}

export const jobStore = new JobStore();
