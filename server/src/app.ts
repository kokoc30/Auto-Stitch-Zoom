import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import uploadRoutes from './routes/upload.routes.js';
import processRoutes from './routes/process.routes.js';
import { UPLOAD_BASE_DIR } from './config/upload.config.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST_DIR = path.resolve(__dirname, '..', '..', 'client', 'dist');
const CLIENT_INDEX_FILE = path.join(CLIENT_DIST_DIR, 'index.html');
const shouldServeBuiltClient =
  process.env.NODE_ENV === 'production' && existsSync(CLIENT_INDEX_FILE);

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_BASE_DIR));

if (shouldServeBuiltClient) {
  app.use(express.static(CLIENT_DIST_DIR, { index: false }));
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Auto Stitch & Zoom API running' });
});

app.use('/api/upload', uploadRoutes);
app.use('/api', processRoutes);

if (shouldServeBuiltClient) {
  app.use((req, res, next) => {
    if (
      (req.method !== 'GET' && req.method !== 'HEAD') ||
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path === '/health'
    ) {
      next();
      return;
    }

    res.sendFile(CLIENT_INDEX_FILE, (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

// Multer upload errors end up here too.
app.use(
  (
    err: Error & { code?: string },
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error('server', 'Unhandled request error', {
      method: req.method,
      path: req.originalUrl,
      code: err.code,
      error: err,
    });

    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        success: false,
        clips: [],
        errors: ['One or more files exceed the maximum size limit (500 MB).'],
      });
      return;
    }

    if (err.message?.includes('File type')) {
      res.status(400).json({
        success: false,
        clips: [],
        errors: [err.message],
      });
      return;
    }

    res.status(500).json({
      success: false,
      clips: [],
      errors: ['An unexpected server error occurred. Please try again.'],
    });
  }
);

export default app;
