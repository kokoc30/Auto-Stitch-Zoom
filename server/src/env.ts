import dotenv from 'dotenv';

dotenv.config();

/**
 * Hosted browser-only deployment profile (e.g. Render Free).
 *
 * When true, all server-side processing and upload routes are blocked with
 * 403 responses. The app shell and static assets (SPA, /ffmpeg/*) continue to
 * serve so the client can run ffmpeg.wasm locally in the user's browser.
 */
export const HOSTED_BROWSER_ONLY: boolean =
  process.env.HOSTED_BROWSER_ONLY === 'true';
