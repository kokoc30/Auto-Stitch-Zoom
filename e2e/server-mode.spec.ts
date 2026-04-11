import { test, expect } from '@playwright/test';
import path from 'node:path';

const FIXTURE = path.resolve(__dirname, 'fixtures/test-clip.mp4');

/**
 * End-to-end server-mode flow: upload a clip, process it on the backend,
 * and confirm the preview + download surfaces render with a valid output.
 */
test.describe('server mode', () => {
  // Server mode is unavailable in hosted browser-only deployments — the
  // server processing + upload routes respond 403 and the UI hides the
  // Server button. Skip this suite in that profile.
  test.skip(
    process.env.HOSTED_BROWSER_ONLY === 'true',
    'Server mode is disabled in HOSTED_BROWSER_ONLY deployments.',
  );

  test('uploads, processes, and exposes preview + download', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('mode-server').click();

    await page.setInputFiles('[data-testid="upload-file-input"]', FIXTURE);
    await expect(page.getByTestId('clip-card')).toHaveCount(1, { timeout: 30_000 });

    const startButton = page.getByTestId('start-processing-button');
    await expect(startButton).toBeEnabled({ timeout: 15_000 });
    await startButton.click();

    await expect(page.getByTestId('active-processing-mode')).toContainText(
      /server/i,
      { timeout: 30_000 },
    );

    await expect(page.getByTestId('processing-complete')).toBeVisible({
      timeout: 120_000,
    });

    const previewVideo = page.getByTestId('preview-video');
    await expect(previewVideo).toBeVisible();
    const previewSrc = await previewVideo.getAttribute('src');
    expect(previewSrc).toBeTruthy();

    const downloadLink = page.getByTestId('download-link');
    await expect(downloadLink).toBeVisible();
    const href = await downloadLink.getAttribute('href');
    expect(href).toBeTruthy();
  });
});
