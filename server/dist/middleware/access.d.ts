import type { RequestHandler, Request } from 'express';
export declare const ACCESS_COOKIE_NAME = "asz_access";
/**
 * Deterministic cookie value derived from the configured password.
 *
 * The cookie stores sha256(password) as hex. Constant-time compared on
 * every request. Pre-image resistance means the cookie cannot be used to
 * recover the password; rotating the password instantly invalidates every
 * outstanding session because the expected hash changes.
 */
export declare function hashPassword(password: string): string;
export declare function hasValidAccessCookie(req: Request, expectedHash: string): boolean;
/**
 * Build the Set-Cookie header value for a valid session.
 *
 * HttpOnly + SameSite=Lax lets the same-origin POST /access form submit
 * and the browser attach the cookie to subsequent navigation. Secure is
 * gated on req.protocol so the cookie is only marked Secure when Express
 * sees HTTPS — which, with `trust proxy` set, is accurate for ngrok /
 * cloudflared tunnels (they forward `X-Forwarded-Proto: https`).
 */
export declare function buildSessionCookie(req: Request, value: string): string;
export declare function buildClearedCookie(req: Request): string;
/**
 * Build the access middleware. When `password` is empty, returns a
 * passthrough — local direct usage, CI, and the existing e2e suite all
 * keep working unchanged. When `password` is set, every request except
 * /health and /access is gated behind a valid session cookie.
 */
export declare function createRequireAccess(password: string): RequestHandler;
//# sourceMappingURL=access.d.ts.map