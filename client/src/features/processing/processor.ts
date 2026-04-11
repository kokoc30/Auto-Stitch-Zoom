import type { ClipItem } from '../../types/clip';
import type { ProcessingOptions } from '../../types/processing';
import type { ProcessingStatusEvent } from './processing.api';
import type { ProcessingMode } from './processing-mode';
import { ServerProcessor } from './server-processor';
import { BrowserProcessor } from './browser-processor';
import { resolveAutoModeAsync } from './browser-capability';

export type ProcessingOutput = {
  previewUrl: string;
  downloadUrl: string;
};

export type ProcessingProgressCallback = (event: ProcessingStatusEvent) => void;

/** The concrete processing backend actually running (never `'auto'`). */
export type ResolvedProcessingMode = 'server' | 'browser';

export interface Processor {
  readonly mode: ProcessingMode;

  /**
   * The backend actually executing this run. For `ServerProcessor` and
   * `BrowserProcessor` this equals `mode`. For `AutoProcessor` this is
   * `null` until the auto decision has been made inside `start()`.
   */
  readonly resolvedMode: ResolvedProcessingMode | null;

  /**
   * Start processing the given clips with the provided options.
   * Resolves with output URLs on success; rejects on error.
   * Progress updates are delivered via the onProgress callback.
   */
  start(
    clips: ClipItem[],
    options: ProcessingOptions,
    onProgress: ProcessingProgressCallback,
  ): Promise<ProcessingOutput>;

  /** Cancel an in-progress processing run. Safe to call multiple times. */
  abort(): void;

  /** Release all resources. Safe to call multiple times. */
  dispose(): void;
}

/**
 * Auto mode resolves to browser or server at processing time based on
 * the actual workload and browser capabilities.
 */
class AutoProcessor implements Processor {
  readonly mode = 'auto' as const;
  private delegate: Processor | null = null;

  get resolvedMode(): ResolvedProcessingMode | null {
    const delegateMode = this.delegate?.mode;
    if (delegateMode === 'browser' || delegateMode === 'server') {
      return delegateMode;
    }
    return null;
  }

  async start(
    clips: ClipItem[],
    options: ProcessingOptions,
    onProgress: ProcessingProgressCallback,
  ): Promise<ProcessingOutput> {
    const decision = await resolveAutoModeAsync(clips, options);
    this.delegate =
      decision.mode === 'browser'
        ? new BrowserProcessor()
        : new ServerProcessor();
    return this.delegate.start(clips, options, onProgress);
  }

  abort(): void {
    this.delegate?.abort();
  }

  dispose(): void {
    this.delegate?.dispose();
    this.delegate = null;
  }
}

export function createProcessor(mode: ProcessingMode): Processor {
  switch (mode) {
    case 'server':
      return new ServerProcessor();
    case 'browser':
      return new BrowserProcessor();
    case 'auto':
      return new AutoProcessor();
  }
}
