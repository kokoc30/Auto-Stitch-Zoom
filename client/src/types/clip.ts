import type { ClipEditSettings } from './processing';

export type ClipItem = {
  id: string;
  filename: string;
  originalName: string;
  duration?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  edits?: ClipEditSettings;
};

export type UploadResponse = {
  success: boolean;
  clips: ClipItem[];
  errors?: string[];
};
