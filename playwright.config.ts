import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config for Auto Stitch & Zoom.
 *
 * These tests run against a REAL production-style build: `npm run start:prod`
 * does the exact same build + serve flow as the hosted deployment — it runs
 * the client prebuild (copies ffmpeg.wasm assets), builds client + server,
 * then starts Express with NODE_ENV=production. This means the COOP/COEP
 * middleware, static serving, SPA fallback, and /ffmpeg/ asset path are all
 * exercised identically to production.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start:prod',
    url: 'http://localhost:3001/health',
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
