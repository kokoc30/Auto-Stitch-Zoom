import express, { Router, type Request, type Response } from 'express';
import {
  buildClearedCookie,
  buildSessionCookie,
  hashPassword,
} from '../middleware/access.js';

/**
 * Tiny no-framework HTML for the access gate. Inline everything — no
 * external CSS, no JS bundle, no client dependencies. Rendered via
 * template literal rather than a view engine to keep the dependency
 * footprint unchanged.
 */
function renderAccessPage(options: {
  showError: boolean;
  redirect: string;
}): string {
  const redirectValue = escapeHtml(options.redirect);
  const errorBlock = options.showError
    ? '<p class="err">Incorrect password. Try again.</p>'
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Access — Auto Stitch &amp; Zoom</title>
    <style>
      :root { color-scheme: light dark; }
      html, body { height: 100%; margin: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
          "Helvetica Neue", Arial, sans-serif;
        background: #0b0d10;
        color: #e6e8eb;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .card {
        width: 100%;
        max-width: 340px;
        background: #14171c;
        border: 1px solid #232830;
        border-radius: 12px;
        padding: 24px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
      }
      h1 {
        font-size: 16px;
        margin: 0 0 4px;
        font-weight: 600;
        letter-spacing: 0.2px;
      }
      p.sub {
        margin: 0 0 18px;
        font-size: 13px;
        color: #9aa3ad;
      }
      label {
        display: block;
        font-size: 12px;
        color: #9aa3ad;
        margin-bottom: 6px;
      }
      input[type=password] {
        width: 100%;
        box-sizing: border-box;
        padding: 10px 12px;
        font-size: 14px;
        background: #0b0d10;
        color: #e6e8eb;
        border: 1px solid #2a2f38;
        border-radius: 8px;
        outline: none;
      }
      input[type=password]:focus { border-color: #4c82ff; }
      button {
        margin-top: 14px;
        width: 100%;
        padding: 10px 12px;
        font-size: 14px;
        font-weight: 600;
        background: #4c82ff;
        color: #fff;
        border: 0;
        border-radius: 8px;
        cursor: pointer;
      }
      button:hover { background: #3a6ee0; }
      p.err {
        margin: 12px 0 0;
        color: #ff6b6b;
        font-size: 13px;
      }
      p.note {
        margin: 16px 0 0;
        font-size: 11px;
        color: #6b7480;
        line-height: 1.4;
      }
    </style>
  </head>
  <body>
    <form class="card" method="POST" action="/access">
      <h1>Auto Stitch &amp; Zoom</h1>
      <p class="sub">This share link is password-protected.</p>
      <label for="password">Access password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus required />
      <input type="hidden" name="redirect" value="${redirectValue}" />
      <button type="submit">Unlock</button>
      ${errorBlock}
      <p class="note">You're about to use an app running on someone else's local machine. Only continue if you trust the person who shared this link.</p>
    </form>
  </body>
</html>`;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * Only allow redirect targets that are same-origin relative paths. Blocks
 * `//evil.com` and absolute URLs entirely.
 */
function sanitizeRedirect(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

/**
 * Creates the access router. When password is empty, this router is not
 * mounted at all (see createApp), so /access is simply 404 in default
 * local mode.
 */
export function createAccessRouter(password: string): Router {
  const expectedHash = hashPassword(password);
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const rawRedirect =
      typeof req.query.redirect === 'string' ? req.query.redirect : '/';
    const showError = req.query.error === '1';
    res
      .status(200)
      .type('html')
      .send(
        renderAccessPage({
          showError,
          redirect: sanitizeRedirect(rawRedirect),
        })
      );
  });

  router.post(
    '/',
    express.urlencoded({ extended: false, limit: '1kb' }),
    (req: Request, res: Response) => {
      const body = (req.body ?? {}) as {
        password?: unknown;
        redirect?: unknown;
      };
      const submitted =
        typeof body.password === 'string' ? body.password : '';
      const redirect = sanitizeRedirect(body.redirect);

      if (submitted !== password) {
        const target = `/access?error=1&redirect=${encodeURIComponent(redirect)}`;
        res.redirect(302, target);
        return;
      }

      res.setHeader('Set-Cookie', buildSessionCookie(req, expectedHash));
      res.redirect(302, redirect);
    }
  );

  router.post('/logout', (req: Request, res: Response) => {
    res.setHeader('Set-Cookie', buildClearedCookie(req));
    res.redirect(302, '/access');
  });

  return router;
}
