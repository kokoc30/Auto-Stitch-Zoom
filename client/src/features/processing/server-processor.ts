import type { ClipItem } from '../../types/clip';
import type { ProcessingOptions } from '../../types/processing';
import type { Processor, ProcessingOutput, ProcessingProgressCallback } from './processor';
import {
  getDownloadUrl,
  getPreviewUrl,
  openProcessingStatusStream,
  parseProcessingStatusEvent,
  startProcessingJob,
} from './processing.api';

export class ServerProcessor implements Processor {
  readonly mode = 'server' as const;
  readonly resolvedMode = 'server' as const;

  private eventSource: EventSource | null = null;
  private aborted = false;

  start(
    clips: ClipItem[],
    options: ProcessingOptions,
    onProgress: ProcessingProgressCallback,
  ): Promise<ProcessingOutput> {
    this.aborted = false;

    return new Promise<ProcessingOutput>(async (resolve, reject) => {
      try {
        const clipFilenames = clips.map((c) => c.filename);

        const data = await startProcessingJob({
          clipFilenames,
          processingOptions: options,
        });

        if (this.aborted) {
          reject(new Error('Processing was cancelled.'));
          return;
        }

        if (!data.success || !data.jobId) {
          reject(new Error(data.error || 'Failed to start processing.'));
          return;
        }

        const jobId = data.jobId;

        const eventSource = openProcessingStatusStream(jobId);
        this.eventSource = eventSource;

        eventSource.onmessage = (event) => {
          if (this.aborted) {
            eventSource.close();
            return;
          }

          const status = parseProcessingStatusEvent(event.data);

          if (!status) {
            console.warn('[sse] Failed to parse SSE message:', event.data);
            return;
          }

          onProgress(status);

          if (status.status === 'done') {
            eventSource.close();
            this.eventSource = null;
            resolve({
              previewUrl: getPreviewUrl(jobId),
              downloadUrl: getDownloadUrl(jobId),
            });
          } else if (status.status === 'error') {
            eventSource.close();
            this.eventSource = null;
            reject(new Error(status.error || 'Processing failed unexpectedly.'));
          }
        };

        eventSource.onerror = () => {
          if (this.aborted) {
            eventSource.close();
            return;
          }

          eventSource.close();
          this.eventSource = null;
          reject(new Error('Lost connection to the server during processing.'));
        };
      } catch (err) {
        if (this.aborted) {
          reject(new Error('Processing was cancelled.'));
          return;
        }

        console.error('[processing] Network error:', err);
        reject(new Error('Processing failed. Check that the server is running.'));
      }
    });
  }

  abort(): void {
    this.aborted = true;
    this.eventSource?.close();
    this.eventSource = null;
  }

  dispose(): void {
    this.abort();
  }
}
