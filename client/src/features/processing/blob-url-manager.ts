/**
 * Centralized blob URL lifecycle management.
 *
 * Every blob URL created for browser-mode output goes through this module
 * so cleanup is deterministic — no leaked object URLs.
 */

const activeBlobUrls = new Set<string>();

export function isBlobUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && url.startsWith('blob:');
}

export function createManagedBlobUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  activeBlobUrls.add(url);
  return url;
}

export function revokeManagedBlobUrl(url: string): void {
  if (activeBlobUrls.has(url)) {
    URL.revokeObjectURL(url);
    activeBlobUrls.delete(url);
  }
}

export function revokeAllManagedBlobUrls(): void {
  for (const url of activeBlobUrls) {
    URL.revokeObjectURL(url);
  }
  activeBlobUrls.clear();
}

/** Returns the number of currently tracked blob URLs (useful for tests). */
export function activeBlobUrlCount(): number {
  return activeBlobUrls.size;
}
