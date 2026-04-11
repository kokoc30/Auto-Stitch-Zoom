import { Router } from 'express';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import {
  UPLOAD_BASE_DIR,
  MAX_FILE_SIZE,
  MAX_FILES_PER_UPLOAD,
  ALLOWED_EXTENSIONS,
} from '../config/upload.config.js';
import { FFMPEG_BIN } from '../config/media-tools.config.js';
import { validateFile, validateVideoMetadata } from '../services/upload.service.js';
import { extractMetadata } from '../services/metadata.service.js';
import type { ClipItem, UploadResponse } from '../types/clip.types.js';
import { logger } from '../utils/logger.js';
import { HOSTED_BROWSER_ONLY } from '../env.js';

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

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    cb(null, true);
  } else {
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

// Hosted browser-only guard. MUST run before multer so a stale client that
// still targets /api/upload does not cause Render to buffer hundreds of MB
// into /app/server/tmp/uploads/incoming before we respond.
router.post(
  '/',
  (req, res, next) => {
    if (HOSTED_BROWSER_ONLY) {
      res.status(403).json({
        success: false,
        clips: [],
        errors: [
          'Uploads are disabled on this deployment. Processing runs locally in your browser.',
        ],
      } satisfies UploadResponse);
      return;
    }
    next();
  },
  upload.array('videos', MAX_FILES_PER_UPLOAD),
  async (req, res): Promise<void> => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        logger.warn('upload', 'Upload request contained no files');
        res.status(400).json({
          success: false,
          clips: [],
          errors: ['No video files were provided.'],
        } satisfies UploadResponse);
        return;
      }

      const clips: ClipItem[] = [];
      const errors: string[] = [];

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
          await fs.unlink(file.path).catch(() => {});
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
          await fs.unlink(file.path).catch(() => {});
          continue;
        }

        const clip: ClipItem = {
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
        } catch (thumbnailError) {
          logger.warn('upload', 'Thumbnail generation skipped', {
            originalName: file.originalname,
            binary: FFMPEG_BIN,
            error: thumbnailError,
          });
        }

        clips.push(clip);
      }

      const response: UploadResponse = {
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
    } catch (err) {
      logger.error('upload', 'Unexpected upload route error', { error: err });
      res.status(500).json({
        success: false,
        clips: [],
        errors: ['An unexpected server error occurred during upload.'],
      } satisfies UploadResponse);
    }
  }
);

export default router;
