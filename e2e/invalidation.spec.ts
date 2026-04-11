import { test, expect } from '@playwright/test';
import path from 'node:path';

const FIXTURE = path.resolve(__dirname, 'fixtures/test-clip.mp4');
const FIXTURE_2 = path.resolve(__dirname, 'fixtures/test-clip-2.mp4');

/**
 * Any project change after a successful run must invalidate the cached
 * output so users never download a stale export. We verify this by
 * finishing a run in server mode, then poking the project and confirming
 * the preview + download sections disappear.
 */
test.describe('output invalidation', () => {
  async function processOnce(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByTestId('mode-server').click();
    await page.setInputFiles('[data-testid="upload-file-input"]', [FIXTURE, FIXTURE_2]);
    await expect(page.getByTestId('clip-card')).toHaveCount(2, { timeout: 30_000 });

    const startButton = page.getByTestId('start-processing-button');
    await expect(startButton).toBeEnabled({ timeout: 15_000 });
    await startButton.click();

    await expect(page.getByTestId('processing-complete')).toBeVisible({
      timeout: 180_000,
    });
    await expect(page.getByTestId('preview-video')).toBeVisible();
    await expect(page.getByTestId('download-link')).toBeVisible();
  }

  test('changing zoom after a finished run clears the output', async ({ page }) => {
    await processOnce(page);

    const slider = page.locator('input.studio-range');
    await slider.focus();
    // Kick the slider off its current value; any change triggers invalidation.
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');

    await expect(page.getByTestId('processing-complete')).toHaveCount(0);
    await expect(page.getByTestId('preview-video')).toHaveCount(0);
    await expect(page.getByTestId('download-link')).toHaveCount(0);
  });

  test('toggling crossfade after a finished run clears the output', async ({ page }) => {
    await processOnce(page);

    const transitionCheckbox = page.locator('input[type="checkbox"].studio-checkbox');
    await transitionCheckbox.click();

    await expect(page.getByTestId('processing-complete')).toHaveCount(0);
    await expect(page.getByTestId('preview-video')).toHaveCount(0);
    await expect(page.getByTestId('download-link')).toHaveCount(0);
  });

  test('removing a clip after a finished run clears the output', async ({ page }) => {
    await processOnce(page);

    // Remove the first clip via its aria-label.
    const removeButton = page.getByRole('button', { name: /^Remove / }).first();
    await removeButton.click();

    await expect(page.getByTestId('clip-card')).toHaveCount(1);
    await expect(page.getByTestId('processing-complete')).toHaveCount(0);
    await expect(page.getByTestId('preview-video')).toHaveCount(0);
    await expect(page.getByTestId('download-link')).toHaveCount(0);
  });
});
