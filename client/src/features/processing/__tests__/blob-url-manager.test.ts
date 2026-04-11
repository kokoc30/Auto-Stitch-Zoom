import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createManagedBlobUrl,
  revokeManagedBlobUrl,
  revokeAllManagedBlobUrls,
  isBlobUrl,
  activeBlobUrlCount,
} from '../blob-url-manager';

let urlCounter = 0;

beforeEach(() => {
  // Clear tracked URLs from previous tests without going through mocks
  revokeAllManagedBlobUrls();
  urlCounter = 0;

  vi.restoreAllMocks();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(
    () => `blob:http://localhost/${++urlCounter}`,
  );
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

describe('isBlobUrl', () => {
  it('returns true for blob: URLs', () => {
    expect(isBlobUrl('blob:http://localhost/1')).toBe(true);
  });

  it('returns false for server URLs', () => {
    expect(isBlobUrl('/api/preview/abc')).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isBlobUrl(null)).toBe(false);
    expect(isBlobUrl(undefined)).toBe(false);
  });
});

describe('createManagedBlobUrl', () => {
  it('creates a blob URL and tracks it', () => {
    const blob = new Blob(['test']);
    const url = createManagedBlobUrl(blob);
    expect(url).toMatch(/^blob:/);
    expect(activeBlobUrlCount()).toBe(1);
  });

  it('tracks multiple URLs', () => {
    createManagedBlobUrl(new Blob(['a']));
    createManagedBlobUrl(new Blob(['b']));
    expect(activeBlobUrlCount()).toBe(2);
  });
});

describe('revokeManagedBlobUrl', () => {
  it('revokes a tracked URL and removes it from tracking', () => {
    const url = createManagedBlobUrl(new Blob(['test']));
    revokeManagedBlobUrl(url);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    expect(activeBlobUrlCount()).toBe(0);
  });

  it('does nothing for untracked URLs', () => {
    revokeManagedBlobUrl('blob:http://localhost/unknown');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe('revokeAllManagedBlobUrls', () => {
  it('revokes all tracked URLs', () => {
    createManagedBlobUrl(new Blob(['a']));
    createManagedBlobUrl(new Blob(['b']));
    createManagedBlobUrl(new Blob(['c']));

    revokeAllManagedBlobUrls();

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
    expect(activeBlobUrlCount()).toBe(0);
  });

  it('is safe to call when empty', () => {
    expect(() => revokeAllManagedBlobUrls()).not.toThrow();
  });
});
