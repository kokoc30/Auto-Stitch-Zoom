import { test, expect } from '@playwright/test';
import path from 'node:path';

const FIXTURE = path.resolve(__dirname, 'fixtures/test-clip.mp4');

/**
 * Verifies browser-local processing works in production: the Browser mode
 * button is enabled (cross-origin isolation is real), processing runs in
 * the tab, and the final output uses a blob: URL from ffmpeg.wasm.
 */
test.describe('browser mode', () => {
  test('browser mode button is enabled under real isolation headers', async ({ page }) => {
    await page.goto('/');
    const browserButton = page.getByTestId('mode-browser');
    await expect(browserButton).toBeEnabled();
  });

  test('processes a clip locally and produces a blob: preview', async ({ page }) => {
    // Surface any browser-side console errors so ffmpeg.wasm failures are
    // visible in the Playwright output instead of being hidden in the UI.
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[browser console ${msg.type()}] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      console.log(`[browser pageerror] ${err.message}`);
    });

    await page.goto('/');

    await page.getByTestId('mode-browser').click();

    await page.setInputFiles('[data-testid="upload-file-input"]', FIXTURE);
    await expect(page.getByTestId('clip-card')).toHaveCount(1, { timeout: 30_000 });

    const startButton = page.getByTestId('start-processing-button');
    await expect(startButton).toBeEnabled({ timeout: 15_000 });
    await startButton.click();

    await expect(page.getByTestId('active-processing-mode')).toContainText(
      /browser/i,
      { timeout: 60_000 },
    );

    await expect(page.getByTestId('processing-complete')).toBeVisible({
      timeout: 180_000,
    });

    const previewSrc = await page.getByTestId('preview-video').getAttribute('src');
    expect(previewSrc).toMatch(/^blob:/);

    const downloadHref = await page.getByTestId('download-link').getAttribute('href');
    expect(downloadHref).toMatch(/^blob:/);
  });
});
