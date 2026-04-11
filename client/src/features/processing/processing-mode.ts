export type ProcessingMode = 'server' | 'browser' | 'auto';

export const DEFAULT_PROCESSING_MODE: ProcessingMode = 'server';

const STORAGE_KEY = 'auto-stitch-zoom.processing-mode';

const SUPPORTED_MODES: ReadonlySet<ProcessingMode> = new Set<ProcessingMode>([
  'server',
  'browser',
  'auto',
]);

export function isProcessingModeSupported(mode: ProcessingMode): boolean {
  return SUPPORTED_MODES.has(mode);
}

function isValidProcessingMode(value: string): value is ProcessingMode {
  return value === 'server' || value === 'browser' || value === 'auto';
}

/**
 * Reads the stored processing mode from localStorage.
 * Normalizes unsupported modes to 'server' so the app never boots into an unusable state.
 */
export function readStoredProcessingMode(): ProcessingMode {
  if (typeof window === 'undefined') {
    return DEFAULT_PROCESSING_MODE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return DEFAULT_PROCESSING_MODE;
    }

    if (!isValidProcessingMode(raw) || !isProcessingModeSupported(raw)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return DEFAULT_PROCESSING_MODE;
    }

    return raw;
  } catch {
    return DEFAULT_PROCESSING_MODE;
  }
}

/**
 * Persists the processing mode to localStorage.
 * If the requested mode is not currently supported, normalizes to 'server'.
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
