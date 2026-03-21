import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',   // .mov
  'video/webm',
] as const;

export const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm'] as const;
export const MAX_FILE_SIZE = 500 * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = 20;
export const UPLOAD_BASE_DIR = path.resolve(__dirname, '..', '..', 'tmp', 'uploads');
