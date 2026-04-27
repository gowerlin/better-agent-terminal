import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: __dirname,
  testMatch: ['e2e/**/*.spec.ts', 'tests/e2e/**/*.test.ts'],
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  outputDir: 'e2e-results',
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
  },
});
