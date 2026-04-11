import { test, expect } from '@playwright/test';
import path from 'node:path';

const FIXTURE = path.resolve(__dirname, 'fixtures/test-clip.mp4');
const FIXTURE_2 = path.resolve(__dirname, 'fixtures/test-clip-2.mp4');

/**
 * Makes sure the processing pipeline is safe to repeat, reset, and extend
 * with new clips across the full lifecycle of a session.
 */
test.describe('processing lifecycle', () => {
  async function runExport(page: import('@playwright/test').Page) {
    const startButton = page.getByTestId('start-processing-button');
    await expect(startButton).toBeEnabled({ timeout: 15_000 });
    await startButton.click();
    await expect(page.getByTestId('processing-complete')).toBeVisible({
      timeout: 180_000,
    });
  }

  test('runs a second export after the first one finishes', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('mode-server').click();

    await page.setInputFiles('[data-testid="upload-file-input"]', FIXTURE);
    await expect(page.getByTestId('clip-card')).toHaveCount(1, { timeout: 30_000 });

    await runExport(page);

    // The button should now read as a re-run affordance.
    const startButton = page.getByTestId('start-processing-button');
    await expect(startButton).toContainText(/reprocess/i);

    // Kick off again directly — the prior run must not block a re-run.
    await startButton.click();
    await expect(page.getByTestId('processing-complete')).toBeVisible({
      timeout: 180_000,
    });
    await expect(page.getByTestId('preview-video')).toBeVisible();
  });

  test('adding a new clip after a finished run clears output and accepts a fresh run', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByTestId('mode-server').click();

    await page.setInputFiles('[data-testid="upload-file-input"]', FIXTURE);
    await expect(page.getByTestId('clip-card')).toHaveCount(1, { timeout: 30_000 });

    await runExport(page);
    await expect(page.getByTestId('preview-video')).toBeVisible();

    // Add a second clip — this should invalidate the previous output.
    await page.setInputFiles('[data-testid="upload-file-input"]', FIXTURE_2);
    await expect(page.getByTestId('clip-card')).toHaveCount(2, { timeout: 30_000 });
    await expect(page.getByTestId('processing-complete')).toHaveCount(0);
    await expect(page.getByTestId('preview-video')).toHaveCount(0);

    // And run again cleanly.
    await runExport(page);
    await expect(page.getByTestId('preview-video')).toBeVisible();
  });
});
