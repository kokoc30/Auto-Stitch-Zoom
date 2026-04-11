import { test, expect } from '@playwright/test';

/**
 * Verifies the production server serves the COOP/COEP headers that the
 * browser-mode runtime requires, and that window.crossOriginIsolated is
 * true in the loaded document. This is the most important test — if it
 * fails, browser mode cannot work at all in the hosted deployment.
 */
test.describe('cross-origin isolation', () => {
  test('HTML response carries COOP/COEP headers', async ({ request }) => {
    const response = await request.get('/');
    expect(response.ok()).toBe(true);

    const headers = response.headers();
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
  });

  test('/health response carries COOP/COEP headers', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBe(true);

    const headers = response.headers();
    expect(headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(headers['cross-origin-embedder-policy']).toBe('require-corp');
  });

  test('window.crossOriginIsolated is true in the loaded document', async ({ page }) => {
    await page.goto('/');
    const isolated = await page.evaluate(() => window.crossOriginIsolated === true);
    expect(isolated).toBe(true);
  });

  test('ffmpeg.wasm core assets are served same-origin', async ({ request }) => {
    const jsResponse = await request.get('/ffmpeg/esm/ffmpeg-core.js');
    expect(jsResponse.status()).toBe(200);

    const wasmResponse = await request.head('/ffmpeg/esm/ffmpeg-core.wasm');
    expect(wasmResponse.status()).toBe(200);
  });
});
