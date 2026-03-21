const DEFAULT_ZOOM_STORAGE_KEY = 'auto-stitch-zoom.default-zoom-percent';

export const DEFAULT_ZOOM = 109;
export const MIN_ZOOM = 100;
export const MAX_ZOOM = 150;

export function clampZoomPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_ZOOM;
  }

  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value)));
}

export function isValidZoomPercent(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_ZOOM && value <= MAX_ZOOM;
}

export function readStoredDefaultZoom(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_ZOOM;
  }

  try {
    const rawValue = window.localStorage.getItem(DEFAULT_ZOOM_STORAGE_KEY);

    if (!rawValue) {
      return DEFAULT_ZOOM;
    }

    const parsedValue = Number.parseInt(rawValue, 10);

    if (!isValidZoomPercent(parsedValue)) {
      window.localStorage.removeItem(DEFAULT_ZOOM_STORAGE_KEY);
      return DEFAULT_ZOOM;
    }

    return parsedValue;
  } catch {
    return DEFAULT_ZOOM;
  }
}

export function persistDefaultZoom(value: number): number {
  const nextValue = clampZoomPercent(value);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(DEFAULT_ZOOM_STORAGE_KEY, String(nextValue));
    } catch {
      // If storage is blocked, just keep the in-memory value.
    }
  }

  return nextValue;
}

export function resetStoredDefaultZoom(): number {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(DEFAULT_ZOOM_STORAGE_KEY);
    } catch {
      // If storage is blocked, just fall back to 109%.
    }
  }

  return DEFAULT_ZOOM;
}
