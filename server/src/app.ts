import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import uploadRoutes from './routes/upload.routes.js';
import processRoutes from './routes/process.routes.js';
import { createAccessRouter } from './routes/access.routes.js';
import { createRequireAccess } from './middleware/access.js';
import { UPLOAD_BASE_DIR } from './config/upload.config.js';
import { HOSTED_BROWSER_ONLY, SHARE_ACCESS_PASSWORD } from './env.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLIENT_DIST_DIR = path.resolve(__dirname, '..', '..', 'client', 'dist');
const CLIENT_INDEX_FILE = path.join(CLIENT_DIST_DIR, 'index.html');
const shouldServeBuiltClient =
  process.env.NODE_ENV === 'production' && existsSync(CLIENT_INDEX_FILE);

export interface CreateAppOptions {
  /**
   * Override the shared-link password for this app instance. Defaults to
   * the SHARE_ACCESS_PASSWORD env var. Empty string disables the gate.
   * Primarily useful for integration tests that need to spin up both the
   * gated and un-gated shapes of the app in the same process.
   */
  accessPassword?: string;
}

export function createApp(options: CreateAppOptions = {}): express.Express {
  const accessPassword = options.accessPassword ?? SHARE_ACCESS_PASSWORD;
  const gateEnabled = accessPassword.length > 0;

  const app = express();

  // Trust reverse proxies (ngrok, Cloudflare Tunnel, any local-share tunnel).
  // With this, req.ip / req.protocol / req.secure reflect the real client via
  // X-Forwarded-* instead of the loopback hop from the tunnel agent. Safe for
  // direct localhost runs too — no X-Forwarded-* means no change in behaviour.
  app.set('trust proxy', true);

  // Cross-origin isolation headers: required for ffmpeg.wasm / SharedArrayBuffer
  // in browser-mode processing. Set on every response so static client assets,
  // /uploads, and /api all carry them. Safe because in production everything is
  // same-origin (served from this same Express server).
  app.use((_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
  });

  app.use(cors());
  app.use(express.json());

  // /health stays public even when the access gate is enabled. It's the
  // operator's tunnel smoke check and carries no sensitive details.
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      message: 'Auto Stitch & Zoom API running',
      mode: HOSTED_BROWSER_ONLY ? 'hosted-browser-only' : 'full',
      serverProcessing: !HOSTED_BROWSER_ONLY,
      accessGate: gateEnabled ? 'enabled' : 'disabled',
      version: 1,
    });
  });

  // Public login routes (only mounted when gate is enabled — otherwise
  // /access is simply 404, leaving no surface for the feature to exist).
  if (gateEnabled) {
    app.use('/access', createAccessRouter(accessPassword));
  }

  // Gate everything below this line. Passthrough when accessPassword is
  // empty, so default local usage is untouched.
  app.use(createRequireAccess(accessPassword));

  app.use('/uploads', express.static(UPLOAD_BASE_DIR));

  if (shouldServeBuiltClient) {
    app.use(express.static(CLIENT_DIST_DIR, { index: false }));
  }

  app.use('/api/upload', uploadRoutes);
  app.use('/api', processRoutes);

  if (shouldServeBuiltClient) {
    app.use((req, res, next) => {
      if (
        (req.method !== 'GET' && req.method !== 'HEAD') ||
        req.path.startsWith('/api') ||
        req.path.startsWith('/uploads') ||
        req.path === '/health' ||
        req.path.startsWith('/access')
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

  return app;
}

const app = createApp();

export default app;
