import type { UploadResponse } from '../../types/clip';

export async function uploadVideos(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();

  for (const file of files) {
    formData.append('videos', file);
  }

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  return response.json() as Promise<UploadResponse>;
}
