import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
/**
 * Integration coverage for the shared-link access gate.
 *
 * Uses Node's built-in test runner (no new devDeps) and spins the real
 * Express app on an ephemeral port, then drives it with the global
 * fetch. Two instances run side-by-side: one with the gate off (default
 * local behaviour), one with the gate on.
 */
const TEST_PASSWORD = 'correct-horse-battery-staple';
function startOnEphemeralPort(app) {
    return new Promise((resolve, reject) => {
        const server = app.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('Failed to obtain ephemeral port'));
                return;
            }
            resolve({
                server,
                baseUrl: `http://127.0.0.1:${address.port}`,
            });
        });
        server.on('error', reject);
    });
}
function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
}
function extractCookieValue(setCookieHeader) {
    if (!setCookieHeader)
        return null;
    const firstPair = setCookieHeader.split(';')[0];
    if (!firstPair)
        return null;
    return firstPair.trim();
}
describe('access gate DISABLED (default local behaviour)', () => {
    let server;
    let baseUrl;
    before(async () => {
        const started = await startOnEphemeralPort(createApp({ accessPassword: '' }));
        server = started.server;
        baseUrl = started.baseUrl;
    });
    after(async () => {
        await closeServer(server);
    });
    test('/health is reachable with no cookie and reports gate disabled', async () => {
        const res = await fetch(`${baseUrl}/health`, { redirect: 'manual' });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.status, 'ok');
        assert.equal(body.accessGate, 'disabled');
        assert.equal(body.mode, 'full');
        assert.equal(body.serverProcessing, true);
    });
    test('/access is NOT mounted when the gate is disabled', async () => {
        const res = await fetch(`${baseUrl}/access`, { redirect: 'manual' });
        assert.equal(res.status, 404);
    });
    test('API routes are not redirected or 401d — they pass through normally', async () => {
        // /api/nothing-here matches no route → Express default 404 HTML.
        // What matters is the absence of 302/401 from the gate.
        const res = await fetch(`${baseUrl}/api/nothing-here`, {
            redirect: 'manual',
        });
        assert.notEqual(res.status, 302);
        assert.notEqual(res.status, 401);
        assert.equal(res.status, 404);
    });
    test('Arbitrary HTML navigation passes without redirect', async () => {
        const res = await fetch(`${baseUrl}/nothing-here`, { redirect: 'manual' });
        assert.notEqual(res.status, 302);
        assert.equal(res.status, 404);
    });
});
describe('access gate ENABLED', () => {
    let server;
    let baseUrl;
    before(async () => {
        const started = await startOnEphemeralPort(createApp({ accessPassword: TEST_PASSWORD }));
        server = started.server;
        baseUrl = started.baseUrl;
    });
    after(async () => {
        await closeServer(server);
    });
    test('/health stays public and reports gate enabled', async () => {
        const res = await fetch(`${baseUrl}/health`, { redirect: 'manual' });
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.status, 'ok');
        assert.equal(body.accessGate, 'enabled');
    });
    test('Unauthorized API request returns 401 JSON (not an HTML redirect)', async () => {
        const res = await fetch(`${baseUrl}/api/upload`, {
            method: 'POST',
            redirect: 'manual',
        });
        assert.equal(res.status, 401);
        const body = await res.json();
        assert.equal(body.success, false);
        assert.match(body.error, /Access gate/i);
    });
    test('Unauthorized HTML navigation redirects to /access?redirect=<path>', async () => {
        const res = await fetch(`${baseUrl}/`, {
            redirect: 'manual',
            headers: { accept: 'text/html' },
        });
        assert.equal(res.status, 302);
        const location = res.headers.get('location') ?? '';
        assert.match(location, /^\/access\?redirect=/);
    });
    test('Unauthorized SSE (job status) is blocked at the gate, not leaked', async () => {
        const res = await fetch(`${baseUrl}/api/job/some-job-id/status`, {
            redirect: 'manual',
        });
        assert.equal(res.status, 401);
    });
    test('Unauthorized preview and download routes are blocked', async () => {
        const preview = await fetch(`${baseUrl}/api/preview/job-id`, {
            redirect: 'manual',
        });
        assert.equal(preview.status, 401);
        const download = await fetch(`${baseUrl}/api/download/job-id`, {
            redirect: 'manual',
        });
        assert.equal(download.status, 401);
    });
    test('GET /access returns the login HTML', async () => {
        const res = await fetch(`${baseUrl}/access`, { redirect: 'manual' });
        assert.equal(res.status, 200);
        const contentType = res.headers.get('content-type') ?? '';
        assert.match(contentType, /text\/html/);
        const html = await res.text();
        assert.match(html, /<form[^>]*method="POST"[^>]*action="\/access"/i);
        assert.match(html, /name="password"/);
    });
    test('POST /access with WRONG password redirects to /access?error=1', async () => {
        const body = new URLSearchParams({
            password: 'nope',
            redirect: '/',
        }).toString();
        const res = await fetch(`${baseUrl}/access`, {
            method: 'POST',
            redirect: 'manual',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
        });
        assert.equal(res.status, 302);
        const location = res.headers.get('location') ?? '';
        assert.match(location, /^\/access\?error=1/);
        assert.equal(res.headers.get('set-cookie'), null);
    });
    test('POST /access with CORRECT password sets cookie + redirects to target', async () => {
        const body = new URLSearchParams({
            password: TEST_PASSWORD,
            redirect: '/',
        }).toString();
        const res = await fetch(`${baseUrl}/access`, {
            method: 'POST',
            redirect: 'manual',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
        });
        assert.equal(res.status, 302);
        assert.equal(res.headers.get('location'), '/');
        const setCookie = res.headers.get('set-cookie');
        assert.ok(setCookie, 'expected Set-Cookie header');
        assert.match(setCookie, /asz_access=/);
        assert.match(setCookie, /HttpOnly/);
        assert.match(setCookie, /SameSite=Lax/);
    });
    test('Session cookie grants access to previously-blocked routes', async () => {
        // Log in, grab cookie, then reuse it.
        const loginBody = new URLSearchParams({
            password: TEST_PASSWORD,
            redirect: '/',
        }).toString();
        const loginRes = await fetch(`${baseUrl}/access`, {
            method: 'POST',
            redirect: 'manual',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body: loginBody,
        });
        const cookie = extractCookieValue(loginRes.headers.get('set-cookie'));
        assert.ok(cookie, 'expected a session cookie from login');
        // HTML navigation with cookie → no longer redirected. Because no SPA
        // build exists in test, Express returns its default 404 — what matters
        // is that the response is NOT a 302 from the gate.
        const htmlRes = await fetch(`${baseUrl}/`, {
            redirect: 'manual',
            headers: { cookie: cookie, accept: 'text/html' },
        });
        assert.notEqual(htmlRes.status, 302);
        // API request with cookie passes the gate. /api/nothing-here has no
        // matching route → 404, again NOT 401.
        const apiRes = await fetch(`${baseUrl}/api/nothing-here`, {
            redirect: 'manual',
            headers: { cookie: cookie },
        });
        assert.notEqual(apiRes.status, 401);
    });
    test('Tampered cookie is rejected', async () => {
        const res = await fetch(`${baseUrl}/api/upload`, {
            method: 'POST',
            redirect: 'manual',
            headers: { cookie: 'asz_access=not-the-right-hash' },
        });
        assert.equal(res.status, 401);
    });
    test('POST /access rejects open-redirect attempts in the redirect field', async () => {
        const body = new URLSearchParams({
            password: TEST_PASSWORD,
            redirect: '//evil.example.com/phish',
        }).toString();
        const res = await fetch(`${baseUrl}/access`, {
            method: 'POST',
            redirect: 'manual',
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
        });
        assert.equal(res.status, 302);
        assert.equal(res.headers.get('location'), '/');
    });
});
//# sourceMappingURL=access.test.js.map