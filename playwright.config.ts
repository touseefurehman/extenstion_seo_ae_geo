import { defineConfig } from '@playwright/test';

// Browser binary: set CHROME_PATH to use an existing Chromium, otherwise run `npx playwright install chromium`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: { trace: 'off' },
});
