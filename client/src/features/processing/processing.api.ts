import type { ProcessingOptions } from '../../types/processing';

export type ProcessingStep =
  | 'validating'
  | 'resolving'
  | 'processing'
  | 'merging'
  | 'done'
  | 'error';

export type StartProcessingRequest = {
  clipFilenames: string[];
  processingOptions: ProcessingOptions;
};

export type StartProcessingResponse = {
  success: boolean;
  jobId?: string;
  error?: string;
};

export type ProcessingStatusEvent = {
  status: ProcessingStep;
  currentStep: string;
  clipIndex: number;
  totalClips: number;
  progress: number;
  error?: string;
};

export async function startProcessingJob(
  payload: StartProcessingRequest
): Promise<StartProcessingResponse> {
  const response = await fetch('/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return response.json() as Promise<StartProcessingResponse>;
}

export function openProcessingStatusStream(jobId: string): EventSource {
  return new EventSource(`/api/job/${jobId}/status`);
}

export function parseProcessingStatusEvent(eventData: string): ProcessingStatusEvent | null {
  try {
    return JSON.parse(eventData) as ProcessingStatusEvent;
  } catch {
    return null;
  }
}

export function getDownloadUrl(jobId: string): string {
  return `/api/download/${jobId}`;
}

export function getPreviewUrl(jobId: string): string {
  return `/api/preview/${jobId}`;
}
