import type { ClipItem } from './clip';
import type { ProcessingOptions } from './processing';

export type ProjectSnapshot = {
  clips: ClipItem[];
  processingOptions: ProcessingOptions | null;
};
