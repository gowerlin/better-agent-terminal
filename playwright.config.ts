import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: path.join(__dirname, 'e2e'),
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  outputDir: 'e2e-results',
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
  },
});
