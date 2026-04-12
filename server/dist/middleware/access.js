import { createHash, timingSafeEqual } from 'node:crypto';
export const ACCESS_COOKIE_NAME = 'asz_access';
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
/**
 * Deterministic cookie value derived from the configured password.
 *
 * The cookie stores sha256(password) as hex. Constant-time compared on
 * every request. Pre-image resistance means the cookie cannot be used to
 * recover the password; rotating the password instantly invalidates every
 * outstanding session because the expected hash changes.
 */
export function hashPassword(password) {
    return createHash('sha256').update(password, 'utf8').digest('hex');
}
function parseCookies(header) {
    if (!header)
        return {};
    const out = {};
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0)
            continue;
        const name = part.slice(0, eq).trim();
        const value = part.slice(eq + 1).trim();
        if (name)
            out[name] = decodeURIComponent(value);
    }
    return out;
}
/**
 * Constant-time string equality on equal-length hex strings. Returns false
 * on any length mismatch to avoid leaking length through timingSafeEqual.
 */
function safeEqualHex(a, b) {
    if (a.length !== b.length)
        return false;
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}
export function hasValidAccessCookie(req, expectedHash) {
    const cookies = parseCookies(req.headers.cookie);
    const actual = cookies[ACCESS_COOKIE_NAME];
    if (!actual)
        return false;
    return safeEqualHex(actual, expectedHash);
}
/**
 * Build the Set-Cookie header value for a valid session.
 *
 * HttpOnly + SameSite=Lax lets the same-origin POST /access form submit
 * and the browser attach the cookie to subsequent navigation. Secure is
 * gated on req.protocol so the cookie is only marked Secure when Express
 * sees HTTPS — which, with `trust proxy` set, is accurate for ngrok /
 * cloudflared tunnels (they forward `X-Forwarded-Proto: https`).
 */
export function buildSessionCookie(req, value) {
    const parts = [
        `${ACCESS_COOKIE_NAME}=${encodeURIComponent(value)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    ];
    if (req.protocol === 'https')
        parts.push('Secure');
    return parts.join('; ');
}
export function buildClearedCookie(req) {
    const parts = [
        `${ACCESS_COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=0',
    ];
    if (req.protocol === 'https')
        parts.push('Secure');
    return parts.join('; ');
}
function wantsJson(req) {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/'))
        return true;
    const accept = req.headers.accept ?? '';
    return accept.includes('application/json') && !accept.includes('text/html');
}
/**
 * Build the access middleware. When `password` is empty, returns a
 * passthrough — local direct usage, CI, and the existing e2e suite all
 * keep working unchanged. When `password` is set, every request except
 * /health and /access is gated behind a valid session cookie.
 */
export function createRequireAccess(password) {
    if (!password) {
        return (_req, _res, next) => next();
    }
    const expectedHash = hashPassword(password);
    return (req, res, next) => {
        if (hasValidAccessCookie(req, expectedHash)) {
            next();
            return;
        }
        if (wantsJson(req)) {
            res.status(401).json({
                success: false,
                error: 'Access gate is enabled. Authenticate via POST /access first.',
            });
            return;
        }
        const redirect = encodeURIComponent(req.originalUrl || '/');
        res.redirect(302, `/access?redirect=${redirect}`);
    };
}
//# sourceMappingURL=access.js.map