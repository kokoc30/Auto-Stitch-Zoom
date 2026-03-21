import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/** Allowed video MIME types for upload validation */
export const ALLOWED_MIME_TYPES = [
    'video/mp4',
    'video/quicktime', // .mov
    'video/webm',
];
/** Allowed file extensions (lowercase, with dot) */
export const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm'];
/** Maximum file size per video: 500 MB */
export const MAX_FILE_SIZE = 500 * 1024 * 1024;
/** Maximum number of files per single upload request */
export const MAX_FILES_PER_UPLOAD = 20;
/** Base directory for all upload storage */
export const UPLOAD_BASE_DIR = path.resolve(__dirname, '..', '..', 'tmp', 'uploads');
//# sourceMappingURL=upload.config.js.map