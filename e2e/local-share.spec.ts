import { test, expect } from '@playwright/test';

/**
 * Regression guard for the local-share / full-profile path.
 *
 * `npm run share:local` is a semantic alias for `npm run start:prod` — the
 * same runner the Playwright webServer block already boots. When
 * HOSTED_BROWSER_ONLY is NOT set (the default), /health must report
 * mode: "full" and serverProcessing: true. If anyone accidentally wires
 * HOSTED_BROWSER_ONLY into the share path, this test flips red.
 *
 * Intentionally skipped when HOSTED_BROWSER_ONLY=true so the Render
 * browser-only build in e2e/hosted-browser-only.spec.ts stays green on the
 * same Playwright config.
 */
test.describe('local-share (full profile) health', () => {
  test.skip(
    process.env.HOSTED_BROWSER_ONLY === 'true',
    'Skipped on hosted browser-only builds — covered by hosted-browser-only.spec.ts',
  );

  test('/health reports full mode with server processing enabled', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({
      status: 'ok',
      mode: 'full',
      serverProcessing: true,
    });
  });

  test('COOP/COEP headers are present on the root document', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
  });
});
