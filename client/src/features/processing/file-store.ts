/**
 * Module-level store for File object references.
 *
 * File objects are not serializable, so they live outside Zustand.
 * BrowserProcessor reads from this map at processing time to access
 * the original user-selected files.
 */

const fileRefs = new Map<string, File>();

export function storeFileRef(clipId: string, file: File): void {
  fileRefs.set(clipId, file);
}

export function getFileRef(clipId: string): File | undefined {
  return fileRefs.get(clipId);
}

export function removeFileRef(clipId: string): void {
  fileRefs.delete(clipId);
}

export function clearFileRefs(): void {
  fileRefs.clear();
}
