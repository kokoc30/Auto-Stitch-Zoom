import type { ClipItem } from '../../types/clip';
import { storeFileRef } from '../processing/file-store';

let idCounter = 0;

function generateLocalId(): string {
  return `local-${Date.now()}-${++idCounter}`;
}

/**
 * Extracts video metadata from a File using a temporary <video> element.
 * Returns duration, width, and height without uploading to the server.
 */
function extractMetadataFromFile(
  file: File,
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    const blobUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(blobUrl);
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      const { videoWidth, videoHeight, duration } = video;

      cleanup();

      if (!videoWidth || !videoHeight) {
        reject(new Error(`"${file.name}" has no video track or unreadable dimensions.`));
        return;
      }

      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error(`"${file.name}" has an unreadable duration.`));
        return;
      }

      resolve({ duration, width: videoWidth, height: videoHeight });
    };

    video.onerror = () => {
      cleanup();
      reject(new Error(`"${file.name}" could not be read as a video.`));
    };

    video.src = blobUrl;
  });
}

/**
 * Creates ClipItem objects from local Files — the browser-mode equivalent
 * of the server upload endpoint.
 *
 * Extracts metadata locally and stores File references for BrowserProcessor.
 * Returns the same shape as the server upload response so the store's
 * addClips() works unchanged.
 */
export async function createLocalClipItems(
  files: File[],
): Promise<{ clips: ClipItem[]; errors: string[] }> {
  const clips: ClipItem[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const meta = await extractMetadataFromFile(file);
      const id = generateLocalId();

      const clip: ClipItem = {
        id,
        filename: id,
        originalName: file.name,
        duration: meta.duration,
        width: meta.width,
        height: meta.height,
        mimeType: file.type || undefined,
        fileSize: file.size,
      };

      storeFileRef(id, file);
      clips.push(clip);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Failed to read "${file.name}".`);
    }
  }

  return { clips, errors };
}
