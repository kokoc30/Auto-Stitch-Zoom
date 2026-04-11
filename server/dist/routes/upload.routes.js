import { Router } from 'express';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { UPLOAD_BASE_DIR, MAX_FILE_SIZE, MAX_FILES_PER_UPLOAD, ALLOWED_EXTENSIONS, } from '../config/upload.config.js';
import { FFMPEG_BIN } from '../config/media-tools.config.js';
import { validateFile, validateVideoMetadata } from '../services/upload.service.js';
import { extractMetadata } from '../services/metadata.service.js';
import { logger } from '../utils/logger.js';
const router = Router();
const execFileAsync = promisify(execFile);
const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
        const uploadDir = path.join(UPLOAD_BASE_DIR, 'incoming');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    },
});
const fileFilter = (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
        cb(null, true);
    }
    else {
        cb(new Error(`File type ${ext} is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
};
const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES_PER_UPLOAD,
    },
});
router.post('/', upload.array('videos', MAX_FILES_PER_UPLOAD), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            logger.warn('upload', 'Upload request contained no files');
            res.status(400).json({
                success: false,
                clips: [],
                errors: ['No video files were provided.'],
            });
            return;
        }
        const clips = [];
        const errors = [];
        for (const file of files) {
            const validationError = validateFile(file.originalname, file.mimetype, file.size);
            if (validationError) {
                logger.warn('upload', 'Rejected uploaded file during validation', {
                    originalName: file.originalname,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                    reason: validationError,
                });
                errors.push(validationError);
                await fs.unlink(file.path).catch(() => { });
                continue;
            }
            const metadata = await extractMetadata(file.path);
            const metadataError = validateVideoMetadata(file.originalname, metadata);
            if (metadataError) {
                logger.warn('upload', 'Rejected uploaded file after media inspection', {
                    originalName: file.originalname,
                    metadata,
                    reason: metadataError,
                });
                errors.push(metadataError);
                await fs.unlink(file.path).catch(() => { });
                continue;
            }
            const clip = {
                id: uuidv4(),
                filename: file.filename,
                originalName: file.originalname,
                duration: metadata.duration,
                width: metadata.width,
                height: metadata.height,
                mimeType: file.mimetype,
                fileSize: file.size,
                thumbnailUrl: undefined,
            };
            // Thumbnail generation is optional, so uploads still work without it.
            try {
                const thumbName = `${uuidv4()}.jpg`;
                const thumbDir = path.join(UPLOAD_BASE_DIR, 'thumbnails');
                await fs.mkdir(thumbDir, { recursive: true });
                const thumbPath = path.join(thumbDir, thumbName);
                await execFileAsync(FFMPEG_BIN, [
                    '-y',
                    '-ss',
                    '00:00:00.5',
                    '-i',
                    file.path,
                    '-frames:v',
                    '1',
                    '-vf',
                    'scale=160:-2',
                    thumbPath,
                ]);
                clip.thumbnailUrl = `/uploads/thumbnails/${thumbName}`;
            }
            catch (thumbnailError) {
                logger.warn('upload', 'Thumbnail generation skipped', {
                    originalName: file.originalname,
                    binary: FFMPEG_BIN,
                    error: thumbnailError,
                });
            }
            clips.push(clip);
        }
        const response = {
            success: clips.length > 0,
            clips,
            errors: errors.length > 0 ? errors : undefined,
        };
        logger.info('upload', 'Upload request completed', {
            receivedFiles: files.length,
            acceptedClips: clips.length,
            rejectedFiles: errors.length,
        });
        res.status(clips.length > 0 ? 200 : 400).json(response);
    }
    catch (err) {
        logger.error('upload', 'Unexpected upload route error', { error: err });
        res.status(500).json({
            success: false,
            clips: [],
            errors: ['An unexpected server error occurred during upload.'],
        });
    }
});
export default router;
//# sourceMappingURL=upload.routes.js.map