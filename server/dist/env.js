import dotenv from 'dotenv';
dotenv.config();
/**
 * Hosted browser-only deployment profile (e.g. Render Free).
 *
 * When true, all server-side processing and upload routes are blocked with
 * 403 responses. The app shell and static assets (SPA, /ffmpeg/*) continue to
 * serve so the client can run ffmpeg.wasm locally in the user's browser.
 */
export const HOSTED_BROWSER_ONLY = process.env.HOSTED_BROWSER_ONLY === 'true';
/**
 * Optional shared-link access gate for the local-share / tunnel workflow.
 *
 * When set (to any non-empty string), Express mounts the access middleware
 * and the tiny /access login page: visitors must submit the password once,
 * then the server sets a signed session cookie that unlocks the app, API,
 * upload, SSE, preview, and download routes.
 *
 * When empty (the default), the gate is a no-op and the app behaves exactly
 * as it does today — local direct usage is unchanged.
 *
 * Never bundled into the client. Never written to logs. Intended as a
 * lightweight "trusted-friends" secret for ngrok / Cloudflare Tunnel
 * sharing, not a replacement for real auth.
 */
export const SHARE_ACCESS_PASSWORD = process.env.SHARE_ACCESS_PASSWORD ?? '';
//# sourceMappingURL=env.js.map