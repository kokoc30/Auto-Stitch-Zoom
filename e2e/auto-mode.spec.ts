import { test, expect } from '@playwright/test';
import path from 'node:path';

const FIXTURE = path.resolve(__dirname, 'fixtures/test-clip.mp4');
const FIXTURE_2 = path.resolve(__dirname, 'fixtures/test-clip-2.mp4');

/**
 * Auto mode selects browser or server automatically based on workload and
 * runtime capability. These tests pin the decision by controlling the inputs:
 * a single tiny clip should route to the browser, while enabling transitions
 * across multiple clips should force the server fallback.
 */
test.describe('auto mode routing', () => {
  // Auto mode's server-fallback branch is unavailable in hosted browser-only
  // deployments — the UI hides the Auto button entirely and the policy
  // throws ServerProcessingDisabledError instead of routing to server.
  test.skip(
    process.env.HOSTED_BROWSER_ONLY === 'true',
    'Auto mode server routing is disabled in HOSTED_BROWSER_ONLY deployments.',
  );

  test('routes a tiny single clip to browser processing', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('mode-auto').click();

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
  });

  test('falls back to server when transitions are enabled', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('mode-auto').click();

    await page.setInputFiles('[data-testid="upload-file-input"]', [FIXTURE, FIXTURE_2]);
    await expect(page.getByTestId('clip-card')).toHaveCount(2, { timeout: 30_000 });

    // Enable crossfade — auto mode must then pick server since browser
    // processor does not implement transitions.
    const transitionCheckbox = page.locator('input[type="checkbox"].studio-checkbox');
    await expect(transitionCheckbox).toBeVisible();
    if (!(await transitionCheckbox.isChecked())) {
      await transitionCheckbox.check();
    }

    const startButton = page.getByTestId('start-processing-button');
    await expect(startButton).toBeEnabled({ timeout: 15_000 });
    await startButton.click();

    await expect(page.getByTestId('active-processing-mode')).toContainText(
      /server/i,
      { timeout: 30_000 },
    );

    await expect(page.getByTestId('processing-complete')).toBeVisible({
      timeout: 180_000,
    });
  });
});
