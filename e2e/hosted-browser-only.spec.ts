import { test, expect } from '@playwright/test';
import path from 'node:path';

const FIXTURE = path.resolve(__dirname, 'fixtures/test-clip.mp4');

/**
 * Verifies the hosted browser-only deployment profile (Render Free).
 *
 * Only runs when the build is actually a hosted browser-only build —
 * gated by the HOSTED_BROWSER_ONLY env var so the normal suite stays
 * green on a full local build.
 *
 *   HOSTED_BROWSER_ONLY=true VITE_HOSTED_BROWSER_ONLY=true \
 *     npx playwright test hosted-browser-only.spec.ts
 *
 * The webServer in playwright.config.ts inherits the parent process env,
 * so npm run start:prod rebuilds with the Vite env flag baked in.
 */
test.describe('hosted browser-only mode', () => {
  test.skip(
    process.env.HOSTED_BROWSER_ONLY !== 'true',
    'Requires HOSTED_BROWSER_ONLY=true build',
  );

  test('hides server/auto mode buttons and shows only browser', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('mode-browser')).toBeVisible();
    await expect(page.getByTestId('mode-server')).toHaveCount(0);
    await expect(page.getByTestId('mode-auto')).toHaveCount(0);
  });

  test('processes locally and makes no server processing/upload calls', async ({ page }) => {
    // Override window.EventSource BEFORE any app script runs so we can assert
    // no SSE connection is ever opened to /api/job/*/status. Playwright's
    // network log would catch the initial GET, but a spy is more explicit
    // and catches anything that bypasses fetch.
    await page.addInitScript(() => {
      const originalEventSource = window.EventSource;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__esCalls = [] as string[];
      class SpyEventSource extends originalEventSource {
        constructor(url: string | URL, init?: EventSourceInit) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__esCalls.push(String(url));
          super(url, init);
        }
      }
      window.EventSource = SpyEventSource as unknown as typeof EventSource;
    });

    const forbiddenRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (
        url.includes('/api/process') ||
        url.includes('/api/upload') ||
        url.includes('/api/job/') ||
        url.includes('/api/preview/') ||
        url.includes('/api/download/')
      ) {
        forbiddenRequests.push(`${req.method()} ${url}`);
      }
    });

    await page.goto('/');

    await page.setInputFiles('[data-testid="upload-file-input"]', FIXTURE);
    await expect(page.getByTestId('clip-card')).toHaveCount(1, { timeout: 30_000 });

    const startButton = page.getByTestId('start-processing-button');
    await expect(startButton).toBeEnabled({ timeout: 15_000 });
    await startButton.click();

    await expect(page.getByTestId('processing-complete')).toBeVisible({
      timeout: 180_000,
    });

    const previewSrc = await page.getByTestId('preview-video').getAttribute('src');
    expect(previewSrc).toMatch(/^blob:/);

    // No network traffic to any server processing or upload endpoint.
    expect(forbiddenRequests).toEqual([]);

    // No EventSource was ever constructed.
    const esCalls = await page.evaluate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => (window as any).__esCalls as string[],
    );
    expect(esCalls).toEqual([]);
  });

  test('direct fetches to /api/process and /api/upload return 403', async ({ page }) => {
    await page.goto('/');

    const processRes = await page.evaluate(async () => {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipFilenames: [], processingOptions: {} }),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    expect(processRes.status).toBe(403);

    const uploadRes = await page.evaluate(async () => {
      const form = new FormData();
      form.append('videos', new Blob(['x']), 'dummy.mp4');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      return { status: res.status, body: await res.json().catch(() => null) };
    });
    expect(uploadRes.status).toBe(403);
  });
});
