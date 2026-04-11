import { HOSTED_BROWSER_ONLY } from './hosted-mode';

export type ProcessingMode = 'server' | 'browser' | 'auto';

export const DEFAULT_PROCESSING_MODE: ProcessingMode = HOSTED_BROWSER_ONLY
  ? 'browser'
  : 'server';

const STORAGE_KEY = 'auto-stitch-zoom.processing-mode';

const SUPPORTED_MODES: ReadonlySet<ProcessingMode> = HOSTED_BROWSER_ONLY
  ? new Set<ProcessingMode>(['browser'])
  : new Set<ProcessingMode>(['server', 'browser', 'auto']);

export function isProcessingModeSupported(mode: ProcessingMode): boolean {
  return SUPPORTED_MODES.has(mode);
}

function isValidProcessingMode(value: string): value is ProcessingMode {
  return value === 'server' || value === 'browser' || value === 'auto';
}

/**
 * Reads the stored processing mode from localStorage.
 *
 * In hosted browser-only deployments this aggressively normalizes any stale
 * value (e.g. a returning visitor whose localStorage still holds `'server'`
 * from a previous full deployment) back to `'browser'` and rewrites the
 * storage key, so server UI can never appear — not even for one render.
 */
export function readStoredProcessingMode(): ProcessingMode {
  if (typeof window === 'undefined') {
    return DEFAULT_PROCESSING_MODE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      if (HOSTED_BROWSER_ONLY) {
        window.localStorage.setItem(STORAGE_KEY, DEFAULT_PROCESSING_MODE);
      }
      return DEFAULT_PROCESSING_MODE;
    }

    if (!isValidProcessingMode(raw) || !isProcessingModeSupported(raw)) {
      window.localStorage.setItem(STORAGE_KEY, DEFAULT_PROCESSING_MODE);
      return DEFAULT_PROCESSING_MODE;
    }

    return raw;
  } catch {
    return DEFAULT_PROCESSING_MODE;
  }
}

/**
 * Persists the processing mode to localStorage.
 * If the requested mode is not currently supported, normalizes to the
 * deployment default (server for full deployments, browser for hosted).
 */
export function persistProcessingMode(mode: ProcessingMode): ProcessingMode {
  const effective = isProcessingModeSupported(mode) ? mode : DEFAULT_PROCESSING_MODE;

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, effective);
    } catch {
      // If storage is blocked, keep the in-memory value.
    }
  }

  return effective;
}
