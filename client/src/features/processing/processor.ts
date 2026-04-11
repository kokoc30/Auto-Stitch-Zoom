import type { ClipItem } from '../../types/clip';
import type { ProcessingOptions } from '../../types/processing';
import type { ProcessingStatusEvent } from './processing.api';
import type { ProcessingMode } from './processing-mode';
import { ServerProcessor } from './server-processor';
import { BrowserProcessor } from './browser-processor';
import { resolveAutoMode, resolveAutoModeAsync } from './browser-capability';
import { HOSTED_BROWSER_ONLY } from './hosted-mode';

export type ProcessingOutput = {
  previewUrl: string;
  downloadUrl: string;
};

export type ProcessingProgressCallback = (event: ProcessingStatusEvent) => void;

/** The concrete processing backend actually running (never `'auto'`). */
export type ResolvedProcessingMode = 'server' | 'browser';

/**
 * Thrown when the user's project cannot run in the browser in a hosted
 * browser-only deployment (Render Free). Carries the capability reason so
 * the UI can surface actionable guidance — no server fallback is attempted
 * and no network call is made.
 */
export class ServerProcessingDisabledError extends Error {
  readonly code = 'SERVER_PROCESSING_DISABLED' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'ServerProcessingDisabledError';
  }
}

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
 *
 * In hosted browser-only deployments, Auto never constructs a
 * `ServerProcessor` — an over-cap workload throws
 * `ServerProcessingDisabledError` so the UI can show actionable guidance.
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
    if (HOSTED_BROWSER_ONLY) {
      const decision = resolveAutoMode(clips, options);
      if (decision.mode === 'server') {
        throw new ServerProcessingDisabledError(decision.reason);
      }
      this.delegate = new BrowserProcessor();
      return this.delegate.start(clips, options, onProgress);
    }

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
  // In hosted browser-only deployments, never construct the server pipeline
  // — even if a caller (stale localStorage, a test, etc.) explicitly asks
  // for it. Server/auto collapse to BrowserProcessor. AutoProcessor still
  // runs when requested so its workload-reason error path fires.
  if (HOSTED_BROWSER_ONLY) {
    if (mode === 'auto') return new AutoProcessor();
    return new BrowserProcessor();
  }

  switch (mode) {
    case 'server':
      return new ServerProcessor();
    case 'browser':
      return new BrowserProcessor();
    case 'auto':
      return new AutoProcessor();
  }
}
